import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Search, DollarSign, Calendar, User, FileText, CheckCircle, Mail, Receipt } from 'lucide-react';
import { DonationFilters, DonationFormData, DONATION_TYPE_OPTIONS } from '@/types/donation';
import { DonationForm } from '@/components/DonationForm';

interface DonationWithDetails {
  id: string;
  familyId: string;
  amount: string;
  type: 'Regular' | 'Special';
  date: string;
  received: boolean;
  emailForThank: boolean;
  emailForTax: boolean;
  comment: string | null;
  createdAt: string;
  family: {
    id: string;
    familyName: string;
  };
  createdByStaff: {
    id: string;
    fullName: string;
    nickName: string;
  };
}

export default function DonationListPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<DonationFilters>({
    familyName: '',
    type: '',
    dateFrom: new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
    received: '',
    emailForThank: '',
    emailForTax: ''
  });
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingDonation, setEditingDonation] = useState<DonationWithDetails | null>(null);

  // Fetch donations with filters
  const { data: donations = [], isLoading } = useQuery({
    queryKey: ['donations', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await fetch(`/api/donations?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch donations');
      }
      return response.json() as Promise<DonationWithDetails[]>;
    }
  });

  // Create donation mutation
  const createDonationMutation = useMutation({
    mutationFn: async (donationData: DonationFormData) => {
      const response = await fetch('/api/donations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(donationData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.errors || 'Failed to create donation';
        throw new Error(errorMessage);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      setIsAddDialogOpen(false);
      setEditingDonation(null);
      toast({
        title: "Success",
        description: "Donation created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update donation mutation
  const updateDonationMutation = useMutation({
    mutationFn: async ({ id, donationData }: { id: string; donationData: DonationFormData }) => {
      const response = await fetch(`/api/donations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(donationData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.errors || 'Failed to update donation';
        throw new Error(errorMessage);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      setIsAddDialogOpen(false);
      setEditingDonation(null);
      toast({
        title: "Success",
        description: "Donation updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete donation mutation
  const deleteDonationMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/donations/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete donation');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      toast({
        title: "Success",
        description: "Donation deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete donation",
        variant: "destructive",
      });
    },
  });

  const totalAmount = useMemo(() => {
    return donations.reduce((sum, donation) => sum + parseFloat(donation.amount), 0);
  }, [donations]);

  const handleFilterChange = (key: keyof DonationFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleAddDonation = () => {
    setEditingDonation(null);
    setIsAddDialogOpen(true);
  };

  const handleEditDonation = (donation: DonationWithDetails) => {
    setEditingDonation(donation);
    setIsAddDialogOpen(true);
  };

  const handleDeleteDonation = async (id: string) => {
    if (confirm('Are you sure you want to delete this donation?')) {
      deleteDonationMutation.mutate(id);
    }
  };

  const handleFormSubmit = async (formData: DonationFormData) => {
    if (editingDonation) {
      updateDonationMutation.mutate({ id: editingDonation.id, donationData: formData });
    } else {
      createDonationMutation.mutate(formData);
    }
  };

  const handleFormCancel = () => {
    setIsAddDialogOpen(false);
    setEditingDonation(null);
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(parseFloat(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const renderStatusIcons = (donation: DonationWithDetails) => {
    return (
      <div className="flex items-center gap-1">
        <CheckCircle
          className={`w-4 h-4 ${donation.received ? 'text-green-600' : 'text-gray-300'}`}
          title={donation.received ? 'Received' : 'Not received'}
        />
        <Mail
          className={`w-4 h-4 ${donation.emailForThank ? 'text-blue-600' : 'text-gray-300'}`}
          title={donation.emailForThank ? 'Thank you email sent' : 'Thank you email not sent'}
        />
        <Receipt
          className={`w-4 h-4 ${donation.emailForTax ? 'text-purple-600' : 'text-gray-300'}`}
          title={donation.emailForTax ? 'Tax receipt email sent' : 'Tax receipt email not sent'}
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto py-6 px-4">
        <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:justify-between lg:items-center">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-emerald-600" />
            <h1 className="text-3xl font-bold text-foreground">Donations Management</h1>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <Button
              onClick={handleAddDonation}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3 text-base"
              size="lg"
            >
              <Plus className="w-5 h-5" />
              Create New Donation
            </Button>
          </div>
        </div>

        {/* Quick Actions Card */}
        <Card className="mb-6 border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Plus className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-emerald-800">Add New Donation</h3>
                  <p className="text-sm text-emerald-600">Click the button to create a new donation record</p>
                </div>
              </div>
              <Button
                onClick={handleAddDonation}
                variant="outline"
                className="flex items-center gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                <Plus className="w-4 h-4" />
                Add Donation
              </Button>
            </div>
          </CardContent>
        </Card>


        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Search & Filter Donations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="familyName">Family Name</Label>
                  <Input
                    id="familyName"
                    placeholder="Search by family name..."
                    value={filters.familyName}
                    onChange={(e) => handleFilterChange('familyName', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select value={filters.type || "all"} onValueChange={(value) => handleFilterChange('type', value === "all" ? "" : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {DONATION_TYPE_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="dateFrom">From Date</Label>
                  <Input
                    id="dateFrom"
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="dateTo">To Date</Label>
                  <Input
                    id="dateTo"
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                  />
                </div>
              </div>

              {/* Status Filters */}
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Status Filters</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                  <div>
                    <Label htmlFor="received">Received Status</Label>
                    <Select value={filters.received || "all"} onValueChange={(value) => handleFilterChange('received', value === "all" ? "" : value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="true">Received</SelectItem>
                        <SelectItem value="false">Not Received</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="emailForThank">Thank You Email</Label>
                    <Select value={filters.emailForThank || "all"} onValueChange={(value) => handleFilterChange('emailForThank', value === "all" ? "" : value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="true">Sent</SelectItem>
                        <SelectItem value="false">Not Sent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="emailForTax">Tax Receipt Email</Label>
                    <Select value={filters.emailForTax || "all"} onValueChange={(value) => handleFilterChange('emailForTax', value === "all" ? "" : value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="true">Sent</SelectItem>
                        <SelectItem value="false">Not Sent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalAmount.toString())}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Records</p>
                  <p className="text-2xl font-bold text-blue-600">{donations.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Date Range</p>
                  <p className="text-sm font-semibold text-purple-600">
                    {formatDate(filters.dateFrom)} - {formatDate(filters.dateTo)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Donations Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Donation Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading donations...</p>
                </div>
              </div>
            ) : donations.length === 0 ? (
              <div className="text-center py-8">
                <DollarSign className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium text-muted-foreground mb-2">No donations found</p>
                <p className="text-sm text-muted-foreground">Try adjusting your filters or add a new donation.</p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Family Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Comment</TableHead>
                        <TableHead>Created By</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {donations.map((donation) => (
                        <TableRow key={donation.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-muted-foreground" />
                              {donation.family.familyName}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={donation.type === 'Special' ? 'default' : 'secondary'}>
                              {donation.type}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(donation.date)}</TableCell>
                          <TableCell className="font-semibold text-emerald-600">
                            {formatCurrency(donation.amount)}
                          </TableCell>
                          <TableCell>
                            {renderStatusIcons(donation)}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {donation.comment || '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {donation.createdByStaff.fullName}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center gap-1 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditDonation(donation)}
                                className="flex items-center gap-1 text-yellow-700 border-yellow-200 hover:bg-yellow-50"
                                title="Update (Edit) this donation"
                              >
                                <Edit className="w-3 h-3" />
                                <span className="hidden sm:inline">Edit</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteDonation(donation.id)}
                                className="flex items-center gap-1 text-red-700 border-red-200 hover:bg-red-50"
                                title="Delete this donation"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span className="hidden sm:inline">Delete</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {donations.map((donation) => (
                    <div
                      key={donation.id}
                      className="border border-border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="font-semibold">{donation.family.familyName}</span>
                        </div>
                        <Badge variant={donation.type === 'Special' ? 'default' : 'secondary'}>
                          {donation.type}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(donation.date)}</span>
                        </div>
                        <div className="font-semibold text-emerald-600 text-lg">
                          {formatCurrency(donation.amount)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-muted-foreground">Status:</div>
                        {renderStatusIcons(donation)}
                      </div>

                      {donation.comment && (
                        <div className="text-sm text-muted-foreground">
                          <strong>Comment:</strong> {donation.comment}
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground">
                        Created by {donation.createdByStaff.fullName}
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditDonation(donation)}
                          className="flex items-center gap-1 text-yellow-700 border-yellow-200 hover:bg-yellow-50 flex-1"
                        >
                          <Edit className="w-3 h-3" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteDonation(donation.id)}
                          className="flex items-center gap-1 text-red-700 border-red-200 hover:bg-red-50 flex-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingDonation ? 'Edit Donation' : 'Add New Donation'}
              </DialogTitle>
            </DialogHeader>
            <DonationForm
              donation={editingDonation}
              onSubmit={handleFormSubmit}
              onCancel={handleFormCancel}
              isSubmitting={createDonationMutation.isPending || updateDonationMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}