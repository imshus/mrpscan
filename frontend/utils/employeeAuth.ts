import type { Employee } from '@/types/employee';

export function authenticateEmployee(
  employees: Employee[],
  method: 'email' | 'phone',
  identifier: string,
  password: string,
): { success: true; employee: Employee } | { success: false; error: string } {
  const normalizedEmail = identifier.trim().toLowerCase();
  const normalizedPhone = identifier.replace(/\D/g, '');

  const employee =
    method === 'email'
      ? employees.find((entry) => entry.email.trim().toLowerCase() === normalizedEmail)
      : employees.find((entry) => entry.phone.replace(/\D/g, '').slice(-10) === normalizedPhone);

  if (!employee) {
    return {
      success: false,
      error:
        method === 'email'
          ? 'Email not registered. Check with your admin.'
          : 'Phone number not registered. Check with your admin.',
    };
  }

  if (employee.password.toLowerCase() !== password.toLowerCase()) {
    return { success: false, error: 'Invalid password. Please try again.' };
  }

  return { success: true, employee };
}
