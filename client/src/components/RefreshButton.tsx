import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export function RefreshButton() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      // Invalidate and refetch all queries
      await queryClient.invalidateQueries();
      await queryClient.refetchQueries();
      
      toast({
        title: "Refreshed!",
        description: "Latest data has been loaded.",
      });
    } catch (error) {
      console.error('Refresh failed:', error);
      toast({
        title: "Refresh Failed",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
      <Button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg border border-blue-500 px-4 py-2 rounded-full flex items-center space-x-2 text-sm font-medium transition-all duration-200 hover:shadow-xl"
        size="sm"
      >
        <RefreshCw 
          className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
        />
        <span>
          {isRefreshing ? 'Refreshing...' : 'Refresh the latest data'}
        </span>
      </Button>
    </div>
  );
}