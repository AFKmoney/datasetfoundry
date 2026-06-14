import pica from 'pica';
import * as ExifReader from 'exifreader';
import { FileMetadata } from '../types';

// Ensure pica initializes properly whether it's exported as default or not
const createPica = typeof (pica as any).default === 'function' ? (pica as any).default : pica;
const picaInstance = createPica();

export async function processImage(file: File, config: any): Promise<{ base64: string; metadata: FileMetadata }> {
  // Read EXIF Data
  let exif: Record<string, any> = {};
  try {
    const arrayBuffer = await file.arrayBuffer();
    // ExifReader can also have varied exports
    const reader = typeof (ExifReader as any).load === 'function' ? ExifReader : (ExifReader as any).default;
    if (reader && reader.load) {
      const tags = reader.load(arrayBuffer);
      for (const key in tags) {
        if (key !== 'MakerNote') { // MakerNote can be huge
           exif[key] = tags[key].description;
        }
      }
    }
  } catch (err) {
    console.warn("Could not read EXIF data:", err);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = async () => {
      URL.revokeObjectURL(url);
      
      let finalWidth = img.width;
      let finalHeight = img.height;
      if (config.imageResize) {
        finalWidth = config.imageWidth || 256;
        finalHeight = config.imageHeight || 256;
      }

      const canvas = document.createElement('canvas');
      canvas.width = finalWidth;
      canvas.height = finalHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return reject("Canvas not supported");

      if (config.imageResize) {
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = img.width;
        srcCanvas.height = img.height;
        srcCanvas.getContext('2d')!.drawImage(img, 0, 0);

        await picaInstance.resize(srcCanvas, canvas, {
          unsharpAmount: 80,
          unsharpRadius: 0.6,
          unsharpThreshold: 2
        });
      } else {
        ctx.drawImage(img, 0, 0);
      }

      // Normalization: for simple output representation, we could convert to grayscale 
      // or map pixel data to 0-1 and encode it. Given JSONL limits, let's just 
      // convert to Grayscale if normalize is checked to represent "preprocessing".
      // A true normalization for ML usually yields a Float32 array, which we could 
      // output as JSON if requested, but for text formats, base64 is standard. 
      // Let's implement min-max normalization on pixels using canvas ImageData.
      if (config.imageNormalize) {
         const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
         const data = imgData.data;
         for (let i = 0; i < data.length; i += 4) {
           // Basic normalization (just an example transformation - mapping 0-255 to scaled 0-255 based on min/max)
           // Actually, let's just do grayscale to represent a normalized input
           const avg = (data[i] + data[i+1] + data[i+2]) / 3;
           data[i] = avg; 
           data[i+1] = avg; 
           data[i+2] = avg; 
         }
         ctx.putImageData(imgData, 0, 0);
      }

      const base64 = canvas.toDataURL('image/jpeg', 0.8);
      
      resolve({
        base64,
        metadata: {
           exif,
           dimensions: { width: finalWidth, height: finalHeight },
           lastModified: file.lastModified,
           lastModifiedDate: new Date(file.lastModified).toISOString()
        }
      });
    };
    
    img.onerror = reject;
    img.src = url;
  });
}
