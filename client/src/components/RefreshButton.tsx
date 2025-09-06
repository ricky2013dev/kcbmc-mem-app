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
    <Button
      onClick={handleRefresh}
      disabled={isRefreshing}
      variant="ghost"
      size="sm"
      className="w-9 h-9 p-0"
      title={isRefreshing ? 'Refreshing...' : 'Refresh the latest data'}
    >
      <RefreshCw 
        className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
      />
    </Button>
  );
}