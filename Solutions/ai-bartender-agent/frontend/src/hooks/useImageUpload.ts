import { useState } from 'react';
import { adminImagesApi } from '../services/api';

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface UseImageUploadResult {
  uploadImage: (file: File, drinkId: string) => Promise<string>;
  isUploading: boolean;
  progress: UploadProgress | null;
  error: string | null;
  reset: () => void;
}

export const useImageUpload = (): UseImageUploadResult => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setIsUploading(false);
    setProgress(null);
    setError(null);
  };

  const uploadImage = async (file: File, drinkId: string): Promise<string> => {
    setIsUploading(true);
    setError(null);
    setProgress({ loaded: 0, total: file.size, percentage: 0 });

    try {
      // Step 1: Get presigned URL from API
      const presignedResponse = await adminImagesApi.generatePresignedUrl(file.type, drinkId);
      const { upload_url, image_key } = presignedResponse;

      // Step 2: Upload directly to S3 with progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentage = Math.round((e.loaded / e.total) * 100);
            setProgress({
              loaded: e.loaded,
              total: e.total,
              percentage,
            });
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'));
        });

        xhr.open('PUT', upload_url);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      setIsUploading(false);
      
      // Return the image key (backend will process and update drink.image_url)
      return image_key;

    } catch (err: any) {
      const errorMessage = err.message || 'Failed to upload image';
      setError(errorMessage);
      setIsUploading(false);
      throw new Error(errorMessage);
    }
  };

  return {
    uploadImage,
    isUploading,
    progress,
    error,
    reset,
  };
};
