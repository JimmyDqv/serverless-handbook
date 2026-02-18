import { useState, useEffect } from 'react';
import { sectionsApi } from '../services/api';
import { Section } from '../types';
import toast from 'react-hot-toast';

export const useSections = () => {
  const [sections, setSections] = useState<Section[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSections = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await sectionsApi.getAll();
        setSections(data.sort((a, b) => a.display_order - b.display_order));
      } catch (err: any) {
        console.error('Error fetching sections:', err);
        setError(err.message || 'Failed to fetch sections');
        toast.error('Failed to load sections');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSections();
  }, []);

  return {
    sections,
    isLoading,
    error,
  };
};