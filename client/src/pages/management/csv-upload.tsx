import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiRequest } from '@/lib/queryClient';
import { Header } from '@/components/Header';
import { Upload, Download, FileText, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

interface UploadResult {
  success: number;
  errors: { row: number; error: string; data: any }[];
  created: {
    departments: string[];
    teams: string[];
    families: string[];
  };
  updated: {
    families: string[];
  };
}

export default function CsvUploadPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  if (user?.group !== 'ADM' && user?.group !== 'MGM') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <Header />
        <div className="pt-20 max-w-4xl mx-auto px-4 py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Admin or Management access required to upload CSV files.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        toast({
          title: 'Invalid file type',
          description: 'Please select a CSV file',
          variant: 'destructive',
        });
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: 'No file selected',
        description: 'Please select a CSV file to upload',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/families/upload-csv', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      const data: UploadResult = await response.json();
      setResult(data);

      if (data.errors.length === 0) {
        toast({
          title: 'Upload successful',
          description: `Successfully imported ${data.success} families`,
        });
      } else {
        toast({
          title: 'Upload completed with errors',
          description: `Imported ${data.success} families, ${data.errors.length} errors`,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message || 'An error occurred during upload',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadSample = () => {
    const csvContent = `Department,Team,Korean Name,English Name,Phone,Email,Address,Business Name,Business Title
남부 연합회,Plano-y 지회,김철수,Kim Chulsoo,2145551234,kim@example.com,"123 Main St, Frisco, TX 75034",ABC Company,CEO
남부 연합회,Plano-y 지회,이영희,Lee Younghee,4695555678,lee@example.com,"456 Oak Ave, Plano, TX 75023",XYZ Corp,Marketing Director
남부 연합회,캐롤톤 지회,박민수,Park Minsoo,9725559012,park@example.com,"789 Elm Blvd, McKinney, TX 75069",Tech Solutions,Senior Engineer`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'family_upload_sample.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Sample downloaded',
      description: 'Sample CSV file downloaded successfully',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <Header />

      <div className="pt-20">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/')}
              className="mr-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              CSV Upload - Family Data
            </h1>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6">
        {/* Instructions Card */}
        <Card className="bg-white/60 backdrop-blur-sm border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="w-5 h-5 mr-2 text-blue-600" />
              CSV Format Instructions
            </CardTitle>
            <CardDescription>
              Follow these guidelines for your CSV file
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Required Columns (in order):</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm">

              </ol>
            </div>



            <Button
              variant="outline"
              onClick={handleDownloadSample}
              className="w-full sm:w-auto"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Sample CSV
            </Button>
          </CardContent>
        </Card>

        {/* Upload Card */}
        <Card className="bg-white/60 backdrop-blur-sm border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Upload className="w-5 h-5 mr-2 text-purple-600" />
              Upload Family Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csv-file">Select CSV File</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </div>

            {file && (
              <div className="bg-green-50 p-3 rounded-lg flex items-center">
                <CheckCircle2 className="w-5 h-5 text-green-600 mr-2" />
                <span className="text-sm">
                  Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(2)} KB)
                </span>
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload CSV
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results Card */}
        {result && (
          <Card className="bg-white/60 backdrop-blur-sm border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center">
                {result.errors.length === 0 ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 mr-2 text-green-600" />
                    Upload Successful
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 mr-2 text-yellow-600" />
                    Upload Completed with Errors
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{result.created.families.length}</div>
                  <div className="text-sm text-gray-600">Families Created</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{result.updated?.families?.length || 0}</div>
                  <div className="text-sm text-gray-600">Families Updated</div>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {result.created.departments.length}
                  </div>
                  <div className="text-sm text-gray-600">New Departments</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {result.created.teams.length}
                  </div>
                  <div className="text-sm text-gray-600">New Teams</div>
                </div>
              </div>

              {result.created.departments.length > 0 && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <h4 className="font-semibold mb-2 text-sm">Created Departments:</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.created.departments.map((dept, idx) => (
                      <span key={idx} className="bg-blue-200 text-blue-800 px-2 py-1 rounded text-xs">
                        {dept}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.created.teams.length > 0 && (
                <div className="bg-purple-50 p-3 rounded-lg">
                  <h4 className="font-semibold mb-2 text-sm">Created Teams:</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.created.teams.map((team, idx) => (
                      <span key={idx} className="bg-purple-200 text-purple-800 px-2 py-1 rounded text-xs">
                        {team}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.updated?.families && result.updated.families.length > 0 && (
                <div className="bg-orange-50 p-3 rounded-lg">
                  <h4 className="font-semibold mb-2 text-sm">Updated Families:</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.updated.families.map((family, idx) => (
                      <span key={idx} className="bg-orange-200 text-orange-800 px-2 py-1 rounded text-xs">
                        {family}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.errors.length > 0 && (
                <div className="bg-red-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2 text-red-800">Errors ({result.errors.length}):</h4>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {result.errors.map((error, idx) => (
                      <div key={idx} className="bg-white p-2 rounded border border-red-200 text-sm">
                        <div className="font-semibold text-red-700">Row {error.row}:</div>
                        <div className="text-gray-600">{error.error}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Data: {JSON.stringify(error.data)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
