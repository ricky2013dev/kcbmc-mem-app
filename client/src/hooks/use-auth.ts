import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface AuthUser {
  id: string;
  fullName: string;
  nickName: string;
  group: string;
  email?: string;
}

interface LoginCredentials {
  nickname: string;
  pin: string;
}

export function useAuth() {
  const queryClient = useQueryClient();

  // Initialize with saved user data if available
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        queryClient.setQueryData(['/api/auth/me'], userData);
      } catch (error) {
        console.error('Error parsing saved user data:', error);
        localStorage.removeItem('currentUser');
      }
    }
  }, [queryClient]);

  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ['/api/auth/me'],
    retry: false,
    staleTime: 15 * 60 * 1000, // 15 minutes - longer cache for better performance
    refetchOnMount: false,
    refetchOnWindowFocus: false, // Avoid performance hits
    enabled: true, // Always check for auth state
    queryFn: async () => {
      // First try to get user from localStorage
      const savedUser = localStorage.getItem('currentUser');
      
      try {
        const res = await fetch('/api/auth/me', {
          credentials: 'include',
        });
        
        if (res.status === 401) {
          // Clear saved user data if unauthorized - this is expected when not logged in
          localStorage.removeItem('currentUser');
          return null;
        }
        
        if (!res.ok) {
          // If server error but we have saved user, return saved user
          if (savedUser) {
            console.log('Server error, using cached user data');
            return JSON.parse(savedUser);
          }
          throw new Error(`${res.status}: ${res.statusText}`);
        }
        
        const userData = await res.json();
        // Save user data to localStorage for persistence
        if (userData) {
          localStorage.setItem('currentUser', JSON.stringify(userData));
        }
        return userData;
      } catch (error) {
        // If network error but we have saved user, return saved user
        if (savedUser) {
          console.log('Network error, using cached user data');
          return JSON.parse(savedUser);
        }
        // Don't throw for 401 errors - they're expected when not authenticated
        if (error instanceof Error && error.message.includes('401')) {
          return null;
        }
        throw error;
      }
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const response = await apiRequest('POST', '/api/auth/login', credentials);
      return response.json();
    },
    onSuccess: (userData) => {
      // Save user data to localStorage immediately after successful login
      if (userData) {
        localStorage.setItem('currentUser', JSON.stringify(userData));
      }
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/auth/logout');
    },
    onSuccess: () => {
      // Clear user data from localStorage on logout
      localStorage.removeItem('currentUser');
      queryClient.setQueryData(['/api/auth/me'], null);
      queryClient.clear();
    },
  });

  // Function to update user data after profile changes
  const updateUser = (updatedUserData: Partial<AuthUser>) => {
    if (user) {
      const newUserData = { ...user, ...updatedUserData };
      queryClient.setQueryData(['/api/auth/me'], newUserData);
      localStorage.setItem('currentUser', JSON.stringify(newUserData));
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    canAddDelete: user?.group === 'ADM' || user?.group === 'MGM',
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    updateUser,
    isLoginPending: loginMutation.isPending,
    isLogoutPending: logoutMutation.isPending,
  };
}
