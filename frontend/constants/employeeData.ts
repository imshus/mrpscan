import { DEFAULT_MATRIX_VALUES } from '@/constants/dashboardMatrices';
import type { Employee, EmployeePermissions } from '@/types/employee';

export const DEFAULT_EMPLOYEE_PERMISSIONS: EmployeePermissions = {
  ...DEFAULT_MATRIX_VALUES,
  upload_new_items: true,
  delete_stock_items: false,
  revoke_access: false,
  settings_formulae: false,
  settings_inventory: false,
  settings_purity: false,
  settings_invoice: false,
  edit_rate_gold: true,
  edit_rate_diamond: true,
  edit_rate_colorstone: true,
  edit_rate_labour: true,
  scan_edit_purity_percent: false,
  scan_rate_rtgs: true,
  scan_rate_cash: true,
};

export const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const;

export const DEMO_EMPLOYEES: Employee[] = [
  {
    id: 'emp-1',
    fullName: 'Rahul Verma',
    designation: 'Senior Salesman',
    phone: '9999999999',
    email: 'rahul.pratham.int@gmail.com',
    gender: 'Male',
    password: 'Rahul@Pratham451',
    permissions: { ...DEFAULT_EMPLOYEE_PERMISSIONS },
  },
  {
    id: 'emp-2',
    fullName: 'Aakash Singh',
    designation: 'Junior Salesman',
    phone: '9876543210',
    email: 'aakash.pratham.int@gmail.com',
    gender: 'Male',
    password: 'Aakash@Pratham451',
    permissions: { ...DEFAULT_EMPLOYEE_PERMISSIONS },
  },
  {
    id: 'emp-3',
    fullName: 'Priya Sharma',
    designation: 'Inventory Manager',
    phone: '9123456780',
    email: 'priya.pratham.int@gmail.com',
    gender: 'Female',
    password: 'Priya@Pratham451',
    permissions: { ...DEFAULT_EMPLOYEE_PERMISSIONS },
  },
  {
    id: 'emp-4',
    fullName: 'Keshav Raathi',
    designation: 'Inventory Manager',
    phone: '9988776655',
    email: 'keshav.pratham.int@gmail.com',
    gender: 'Male',
    password: 'Keshav@Pratham451',
    permissions: { ...DEFAULT_EMPLOYEE_PERMISSIONS },
  },
];
