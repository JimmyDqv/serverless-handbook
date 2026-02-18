import { useState, useEffect } from 'react';
import { adminDrinksApi } from '../services/api';
import { Drink, CreateDrinkRequest, UpdateDrinkRequest } from '../types';
import toast from 'react-hot-toast';

export const useAdminDrinks = () => {
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDrinks = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await adminDrinksApi.getAll();
      setDrinks(data);
    } catch (err: any) {
      console.error('Error fetching admin drinks:', err);
      setError(err.message || 'Failed to fetch drinks');
      toast.error('Kunde inte ladda drinkar');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDrinks();
  }, []);

  const createDrink = async (drinkData: CreateDrinkRequest) => {
    try {
      const newDrink = await adminDrinksApi.create(drinkData);
      setDrinks(prevDrinks => [...prevDrinks, newDrink]);
      toast.success('Drink skapad');
      return newDrink;
    } catch (err: any) {
      console.error('Error creating drink:', err);
      toast.error(err.message || 'Failed to create drink');
      throw err;
    }
  };

  const updateDrink = async (drinkData: UpdateDrinkRequest) => {
    try {
      const updatedDrink = await adminDrinksApi.update(drinkData);
      setDrinks(prevDrinks =>
        prevDrinks.map(drink =>
          drink.id === drinkData.id ? updatedDrink : drink
        )
      );
      toast.success('Drink uppdaterad');
      return updatedDrink;
    } catch (err: any) {
      console.error('Error updating drink:', err);
      toast.error(err.message || 'Failed to update drink');
      throw err;
    }
  };

  const deleteDrink = async (drinkId: string) => {
    try {
      await adminDrinksApi.delete(drinkId);
      setDrinks(prevDrinks =>
        prevDrinks.filter(drink => drink.id !== drinkId)
      );
      toast.success('Drink borttagen');
    } catch (err: any) {
      console.error('Error deleting drink:', err);
      toast.error(err.message || 'Kunde inte ta bort drink');
      throw err;
    }
  };

  const refetch = () => {
    fetchDrinks();
  };

  return {
    drinks,
    isLoading,
    error,
    createDrink,
    updateDrink,
    deleteDrink,
    refetch,
  };
};