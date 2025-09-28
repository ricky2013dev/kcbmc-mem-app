import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Users, Phone, MapPin } from 'lucide-react';

interface Family {
  id: string;
  familyName: string;
  phoneNumber: string;
  address: string;
  city: string;
  state: string;
  memberStatus: string;
}

interface FamilySearchPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFamilySelect: (family: { id: string; familyName: string }) => void;
}

export function FamilySearchPopup({ open, onOpenChange, onFamilySelect }: FamilySearchPopupProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch families matching search term
  const { data: families = [], isLoading } = useQuery({
    queryKey: ['families-search', searchTerm],
    queryFn: async () => {
      const response = await fetch(`/api/families?name=${encodeURIComponent(searchTerm)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch families');
      }
      const data = await response.json();
      return data.map((family: any) => ({
        id: family.id,
        familyName: family.familyName,
        phoneNumber: family.phoneNumber,
        address: family.address,
        city: family.city,
        state: family.state,
        memberStatus: family.memberStatus
      })) as Family[];
    },
    enabled: open && searchTerm.length >= 1
  });

  const handleFamilySelect = (family: Family) => {
    onFamilySelect({
      id: family.id,
      familyName: family.familyName
    });
    onOpenChange(false);
    setSearchTerm('');
  };

  useEffect(() => {
    if (!open) {
      setSearchTerm('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search Family
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="search">Family Name</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                id="search"
                placeholder="Type to search families..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>
          </div>

          <ScrollArea className="h-96">
            {searchTerm.length < 1 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Start typing to search for families</p>
              </div>
            ) : isLoading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-muted-foreground">Searching families...</p>
              </div>
            ) : families.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No families found matching "{searchTerm}"</p>
              </div>
            ) : (
              <div className="space-y-2">
                {families.map((family) => (
                  <div
                    key={family.id}
                    className="p-4 border border-border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => handleFamilySelect(family)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <h3 className="font-semibold">{family.familyName}</h3>
                          <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                            family.memberStatus === 'member'
                              ? 'bg-green-100 text-green-700'
                              : family.memberStatus === 'visit'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {family.memberStatus}
                          </span>
                        </div>

                        <div className="space-y-1 text-sm text-muted-foreground">
                          {family.phoneNumber && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              <span>{family.phoneNumber}</span>
                            </div>
                          )}

                          {(family.address || family.city || family.state) && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              <span>
                                {[family.address, family.city, family.state]
                                  .filter(Boolean)
                                  .join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <Button variant="ghost" size="sm">
                        Select
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}