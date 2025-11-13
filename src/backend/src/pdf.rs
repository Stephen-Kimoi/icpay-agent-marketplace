use ic_cdk::println;
use image::imageops::FilterType;
use image::{DynamicImage, GenericImageView};
use jpeg_encoder::{ColorType as JpegColorType, Encoder};
use lopdf::{Document, Object, ObjectId, Stream};

/// Configuration for PDF compression.
#[derive(Clone, Debug)]
pub struct CompressionOptions {
    /// JPEG quality used when recompressing images (1-100).
    pub jpeg_quality: u8,
    /// Whether embedded images should be recompressed.
    pub compress_images: bool,
    /// Whether the compressor should strip metadata from the PDF.
    pub remove_metadata: bool,
    /// Optional maximum dimension applied when downscaling images.
    pub max_image_dimension: Option<u32>,
}

impl Default for CompressionOptions {
    fn default() -> Self {
        Self {
            jpeg_quality: 70,
            compress_images: true,
            remove_metadata: true,
            max_image_dimension: Some(2_048),
        }
    }
}

/// Main PDF compression utility.
pub struct PdfCompressor {
    options: CompressionOptions,
}

impl PdfCompressor {
    /// Create a compressor with default options for a given quality.
    pub fn new(quality: u8) -> Self {
        let mut options = CompressionOptions::default();
        options.jpeg_quality = quality.clamp(1, 100);
        Self { options }
    }

    /// Create a compressor with custom options.
    #[allow(dead_code)]
    pub fn with_options(options: CompressionOptions) -> Self {
        let mut options = options;
        options.jpeg_quality = options.jpeg_quality.clamp(1, 100);
        Self { options }
    }

    /// Compress an in-memory PDF and return the resulting bytes.
    pub fn compress(&self, input_pdf: Vec<u8>) -> Result<Vec<u8>, String> {
        let mut doc = Document::load_mem(&input_pdf)
            .map_err(|e| format!("Failed to load PDF: {}", e))?;

        if self.options.compress_images {
            self.compress_pdf_images(&mut doc)?;
        }

        self.optimize_streams(&mut doc)?;

        if self.options.remove_metadata {
            self.remove_metadata(&mut doc)?;
        }

        let mut buffer = Vec::new();
        doc.save_to(&mut buffer)
            .map_err(|e| format!("Failed to save PDF: {}", e))?;

        Ok(buffer)
    }

    fn compress_pdf_images(&self, doc: &mut Document) -> Result<(), String> {
        let object_ids: Vec<ObjectId> = doc.objects.keys().cloned().collect();

        for object_id in object_ids {
            let stream_result = doc
                .get_object_mut(object_id)
                .and_then(Object::as_stream_mut);

            let stream = match stream_result {
                Ok(stream) => stream,
                Err(_) => continue,
            };

            if self.is_image_stream(stream) {
                if let Err(err) = self.compress_image_stream(stream) {
                    println!(
                        "pdf_compressor: failed to compress image stream {:?}: {}",
                        object_id, err
                    );
                }
            }
        }

        Ok(())
    }

    fn is_image_stream(&self, stream: &Stream) -> bool {
        stream
            .dict
            .get(b"Subtype")
            .and_then(|obj| obj.as_name_str())
            .map(|name| name.eq_ignore_ascii_case("Image"))
            .unwrap_or(false)
    }

    fn compress_image_stream(&self, stream: &mut Stream) -> Result<(), String> {
        let image_data = stream
            .decompressed_content()
            .map_err(|e| format!("Failed to decompress stream: {}", e))?;

        let mut image = image::load_from_memory(&image_data)
            .map_err(|e| format!("Failed to decode embedded image: {}", e))?;

        if let Some(max_dimension) = self.options.max_image_dimension {
            self.downscale_if_needed(&mut image, max_dimension);
        }

        let rgb_image = image.to_rgb8();
        let (width, height) = rgb_image.dimensions();

        if width == 0 || height == 0 {
            return Ok(());
        }

        let mut buffer = Vec::new();
        let jpeg_quality = self.scale_quality_for_encoder(self.options.jpeg_quality);
        let pixel_bytes = rgb_image.as_raw();

        Encoder::new(&mut buffer, jpeg_quality)
            .encode(
                pixel_bytes.as_slice(),
                width.min(u16::MAX as u32) as u16,
                height.min(u16::MAX as u32) as u16,
                JpegColorType::Rgb,
            )
            .map_err(|e| format!("Failed to encode JPEG: {}", e))?;

        stream.set_plain_content(buffer);
        stream
            .dict
            .set(b"Filter", Object::Name(b"DCTDecode".to_vec()));
        stream
            .dict
            .set(b"ColorSpace", Object::Name(b"DeviceRGB".to_vec()));
        stream.dict.set(b"BitsPerComponent", Object::Integer(8));
        stream
            .dict
            .set(b"Width", Object::Integer(width as i64));
        stream
            .dict
            .set(b"Height", Object::Integer(height as i64));
        stream.dict.remove(b"DecodeParms");

        Ok(())
    }

    fn downscale_if_needed(&self, image: &mut DynamicImage, max_dimension: u32) {
        let (width, height) = image.dimensions();
        let current_max = width.max(height);

        if current_max <= max_dimension || max_dimension == 0 {
            return;
        }

        let scale = max_dimension as f32 / current_max as f32;
        let new_width = ((width as f32) * scale).round().max(1.0) as u32;
        let new_height = ((height as f32) * scale).round().max(1.0) as u32;

        *image = image.resize(new_width, new_height, FilterType::Lanczos3);
    }

    fn scale_quality_for_encoder(&self, quality: u8) -> u8 {
        // jpeg-encoder expects a 1-255 quality value. Map 1-100 to that range.
        let clamped = quality.clamp(1, 100) as u16;
        ((clamped * 255) / 100).max(1).min(255) as u8
    }

    fn optimize_streams(&self, doc: &mut Document) -> Result<(), String> {
        for (_id, object) in doc.objects.iter_mut() {
            if let Ok(stream) = object.as_stream_mut() {
                if self.is_image_stream(stream) {
                    continue;
                }

                stream
                    .compress()
                    .map_err(|e| format!("Failed to apply Flate compression: {}", e))?;
            }
        }

        Ok(())
    }

    fn remove_metadata(&self, doc: &mut Document) -> Result<(), String> {
        doc.trailer.remove(b"Info");
        doc.trailer.remove(b"ID");

        if let Ok(catalog) = doc.catalog_mut() {
            if let Some(metadata) = catalog.remove(b"Metadata") {
                if let Ok(reference) = metadata.as_reference() {
                    doc.delete_object(reference);
                }
            }
        }

        Ok(())
    }
}

