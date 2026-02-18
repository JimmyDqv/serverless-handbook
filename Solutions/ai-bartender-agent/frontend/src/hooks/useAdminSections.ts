import { useState, useEffect } from 'react';
import { adminSectionsApi } from '../services/api';
import { Section, CreateSectionRequest, UpdateSectionRequest } from '../types';
import toast from 'react-hot-toast';

export const useAdminSections = () => {
  const [sections, setSections] = useState<Section[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSections = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await adminSectionsApi.getAll();
      setSections(data);
    } catch (err: any) {
      console.error('Error fetching admin sections:', err);
      setError(err.message || 'Failed to fetch sections');
      toast.error('Kunde inte ladda sektioner');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSections();
  }, []);

  const createSection = async (sectionData: CreateSectionRequest) => {
    try {
      const newSection = await adminSectionsApi.create(sectionData);
      setSections(prevSections => [...prevSections, newSection].sort((a, b) => a.display_order - b.display_order));
      toast.success('Sektion skapad');
      return newSection;
    } catch (err: any) {
      console.error('Error creating section:', err);
      const message = err.message || 'Failed to create section';
      toast.error(message);
      throw err;
    }
  };

  const updateSection = async (sectionData: UpdateSectionRequest) => {
    try {
      const updatedSection = await adminSectionsApi.update(sectionData);
      setSections(prevSections =>
        prevSections
          .map(section => section.id === sectionData.id ? updatedSection : section)
          .sort((a, b) => a.display_order - b.display_order)
      );
      toast.success('Sektion uppdaterad');
      return updatedSection;
    } catch (err: any) {
      console.error('Error updating section:', err);
      const message = err.message || 'Failed to update section';
      toast.error(message);
      throw err;
    }
  };

  const deleteSection = async (sectionId: string) => {
    try {
      await adminSectionsApi.delete(sectionId);
      setSections(prevSections =>
        prevSections.filter(section => section.id !== sectionId)
      );
      toast.success('Sektion borttagen');
    } catch (err: any) {
      console.error('Error deleting section:', err);
      // Check if it's a conflict error (section has drinks)
      const message = err.message || 'Failed to delete section';
      toast.error(message);
      throw err;
    }
  };

  const refetch = () => {
    fetchSections();
  };

  return {
    sections,
    isLoading,
    error,
    createSection,
    updateSection,
    deleteSection,
    refetch
  };
};
