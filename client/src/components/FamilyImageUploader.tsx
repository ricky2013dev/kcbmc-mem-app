import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FamilyImageUploaderProps {
  onUploadComplete: (imageUrl: string) => void;
  currentImage?: string;
}

export function FamilyImageUploader({ onUploadComplete, currentImage }: FamilyImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (JPG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "File size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', file);
      
      // Upload file directly
      const uploadResponse = await fetch('/api/objects/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }
      
      const uploadResult = await uploadResponse.json();
      
      // Process the uploaded image
      const processResponse = await fetch('/api/family-images', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          imageURL: uploadResult.uploadURL || uploadResult.objectPath,
        }),
      });

      if (!processResponse.ok) {
        throw new Error('Failed to process uploaded image');
      }

      const processData = await processResponse.json();
      
      // Call completion handler with the processed image URL
      onUploadComplete(processData.objectPath);

      toast({
        title: "Success",
        description: "Family picture uploaded successfully.",
      });

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* Current Image Preview */}
      {currentImage && (
        <div className="relative">
          <img
            src={currentImage}
            alt="Family preview"
            className="w-32 h-32 object-cover rounded-lg border"
          />
        </div>
      )}

      {/* Upload Area */}
      {!currentImage && (
        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-2">
            Upload a family picture
          </p>
          <p className="text-xs text-muted-foreground">
            JPG, PNG up to 5MB
          </p>
        </div>
      )}

      {/* Upload Button */}
      <Button
        type="button"
        variant="outline"
        onClick={handleButtonClick}
        disabled={isUploading}
      >
        <Upload className="w-4 h-4 mr-2" />
        {isUploading ? 'Uploading...' : currentImage ? 'Change Picture' : 'Upload Picture'}
      </Button>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}