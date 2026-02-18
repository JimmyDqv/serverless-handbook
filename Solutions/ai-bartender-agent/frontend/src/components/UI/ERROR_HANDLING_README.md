# Error Handling and Empty States Components

This document describes the comprehensive error handling and empty state system implemented for the AI Bartender application.

## Overview

The error handling system provides:
- **Toast Notifications**: User-friendly notifications with different types and auto-dismiss
- **Form Validation**: Inline validation with visual feedback and accessibility support
- **Network Error Handling**: Automatic retry mechanisms and offline detection
- **Empty States**: Consistent empty state components with helpful messaging
- **Loading States**: Enhanced loading indicators for buttons and forms

## Components

### Toast System

#### ToastProvider
Wrap your app with the ToastProvider to enable toast notifications throughout the application.

```tsx
import { ToastProvider } from '../contexts/ToastContext';

function App() {
  return (
    <ToastProvider position="top-right" maxToasts={5}>
      {/* Your app content */}
    </ToastProvider>
  );
}
```

#### useToast Hook
Use the toast hook to show notifications from any component.

```tsx
import { useToast } from '../contexts/ToastContext';

function MyComponent() {
  const { showSuccess, showError, showWarning, showInfo } = useToast();

  const handleSuccess = () => {
    showSuccess('Success!', 'Operation completed successfully.');
  };

  const handleError = () => {
    showError('Error occurred', 'Please try again later.', 8000);
  };

  const handleWarning = () => {
    showWarning('Warning', 'Please check your input.');
  };

  const handleInfo = () => {
    showInfo('Information', 'Here is some helpful information.', 0, {
      action: {
        label: 'Learn more',
        onClick: () => console.log('Action clicked')
      }
    });
  };
}
```

### Form Validation

#### useFormValidation Hook
Provides comprehensive form validation with inline error display.

```tsx
import { useFormValidation } from '../hooks/useFormValidation';

function MyForm() {
  const {
    values,
    errors,
    touched,
    isValid,
    setValue,
    setTouched,
    handleSubmit,
    reset
  } = useFormValidation(
    { email: '', name: '' }, // Initial values
    {
      email: {
        required: true,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      },
      name: {
        required: true,
        minLength: 2,
        maxLength: 50
      }
    }
  );

  const onSubmit = async (formData) => {
    // Handle form submission
    console.log('Form data:', formData);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input
        label="Email"
        value={values.email}
        onChange={(e) => setValue('email', e.target.value)}
        onBlur={() => setTouched('email')}
        error={touched.email ? errors.email : undefined}
        required
      />
      <LoadingButton type="submit" disabled={!isValid}>
        Submit
      </LoadingButton>
    </form>
  );
}
```

#### Enhanced Input Component
The Input component now supports validation states, loading indicators, and icons.

```tsx
<Input
  label="Email Address"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error="Please enter a valid email"
  success={true}
  isLoading={false}
  leftIcon={<EmailIcon />}
  rightIcon={<CheckIcon />}
  helperText="We'll never share your email"
  required
/>
```

### Network Error Handling

#### useNetworkError Hook
Provides network error detection, retry mechanisms, and offline handling.

```tsx
import { useNetworkError } from '../hooks/useNetworkError';

function MyComponent() {
  const { executeWithRetry, handleNetworkError, networkState } = useNetworkError();

  const fetchData = async () => {
    try {
      const data = await executeWithRetry(
        () => api.getData(),
        {
          maxRetries: 3,
          retryDelay: 1000,
          exponentialBackoff: true,
          onRetry: (attempt) => {
            console.log(`Retry attempt ${attempt}`);
          },
          onMaxRetriesReached: () => {
            console.log('Max retries reached');
          }
        }
      );
      return data;
    } catch (error) {
      handleNetworkError(error, 'Data fetch');
    }
  };

  return (
    <div>
      <p>Online: {networkState.isOnline ? 'Yes' : 'No'}</p>
      <p>Network Error: {networkState.hasNetworkError ? 'Yes' : 'No'}</p>
      <p>Retrying: {networkState.isRetrying ? 'Yes' : 'No'}</p>
      <button onClick={fetchData}>Fetch Data</button>
    </div>
  );
}
```

#### OfflineIndicator Component
Shows a banner when the user goes offline or comes back online.

```tsx
import { OfflineIndicator } from '../components/UI';

function App() {
  return (
    <div>
      <OfflineIndicator showWhenOnline onRetry={() => window.location.reload()} />
      {/* Your app content */}
    </div>
  );
}
```

### Empty States

#### Predefined Empty State Components

```tsx
import {
  NoDrinksEmptyState,
  NoOrdersEmptyState,
  SearchEmptyState,
  OfflineEmptyState
} from '../components/UI';

// No drinks available
<NoDrinksEmptyState onRefresh={() => refetchDrinks()} />

// No orders in queue
<NoOrdersEmptyState />

// No search results
<SearchEmptyState 
  searchTerm="mojito" 
  onClearSearch={() => setSearchTerm('')} 
/>

// Offline state
<OfflineEmptyState onRetry={() => window.location.reload()} />
```

#### Custom Empty State Component

```tsx
import { EmptyState } from '../components/UI';

<EmptyState
  icon={<CustomIcon />}
  title="No Items Found"
  description="There are no items to display at the moment."
  action={{
    label: "Add Item",
    onClick: () => openAddItemModal()
  }}
/>
```

### Loading States

#### LoadingButton Component
Enhanced button with loading states and haptic feedback.

```tsx
import { LoadingButton } from '../components/UI';

<LoadingButton
  isLoading={isSubmitting}
  loadingText="Saving..."
  variant="primary"
  size="md"
  onClick={handleSubmit}
  disabled={!isValid}
>
  Save Changes
</LoadingButton>
```

#### FormLoadingOverlay Component
Shows a loading overlay over forms during submission.

```tsx
import { FormLoadingOverlay } from '../components/UI';

<div className="relative">
  <FormLoadingOverlay isLoading={isSubmitting} message="Saving changes..." />
  <form>
    {/* Form content */}
  </form>
</div>
```

## Accessibility Features

All components include comprehensive accessibility support:

- **ARIA labels and roles**: Proper semantic markup
- **Screen reader support**: Announcements for state changes
- **Keyboard navigation**: Full keyboard accessibility
- **Focus management**: Proper focus handling
- **Reduced motion**: Respects user's motion preferences
- **Color contrast**: WCAG AA compliant colors

## Styling and Theming

Components use the design system colors and support both light and dark themes:

```css
/* Toast types */
.toast-success { /* Teal colors */ }
.toast-error { /* Coral/red colors */ }
.toast-warning { /* Yellow colors */ }
.toast-info { /* Blue colors */ }

/* Form validation states */
.input-error { /* Red border and focus ring */ }
.input-success { /* Green border and focus ring */ }
```

## Best Practices

### Toast Notifications
- Use appropriate toast types (success, error, warning, info)
- Keep messages concise and actionable
- Use longer durations for error messages
- Provide actions when helpful (retry, learn more)

### Form Validation
- Validate on blur for better UX
- Show errors only after user interaction
- Use clear, helpful error messages
- Disable submit buttons when form is invalid

### Network Errors
- Implement retry mechanisms for transient failures
- Show offline indicators when appropriate
- Provide clear error messages with next steps
- Handle different error types appropriately

### Empty States
- Use appropriate empty state components
- Provide helpful messaging and next steps
- Include actions when possible (refresh, add item)
- Use consistent iconography and styling

## Integration with Existing Code

The error handling system integrates seamlessly with existing components:

1. **Replace existing toast libraries** with the new toast system
2. **Enhance forms** with the validation hook and enhanced inputs
3. **Add network error handling** to API calls
4. **Replace empty state markup** with the new components
5. **Update loading states** to use the new loading components

## Examples

See `frontend/src/components/Examples/ErrorHandlingDemo.tsx` for a comprehensive demonstration of all error handling features.