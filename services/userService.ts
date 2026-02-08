/**
 * User Service
 * 
 * Handles user management operations
 */

import { User,UserRole } from '../types';
import { supabase } from './supabaseClient';

/**
 * Lightweight user fields for lists/dropdowns (reduces egress ~80%)
 */
const USER_SELECT_LIGHTWEIGHT = 'user_id, name, full_name, email, role, is_active, phone';

/**
 * Get all users (full data - use sparingly)
 */
export const getUsers = async (): Promise<User[]> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('name');

  if (error) throw new Error(error.message);
  return data as User[];
};

/**
 * Get all users (lightweight - for lists, dropdowns, dashboards)
 */
export const getUsersLightweight = async (): Promise<User[]> => {
  const { data, error } = await supabase
    .from('users')
    .select(USER_SELECT_LIGHTWEIGHT)
    .order('name');

  if (error) throw new Error(error.message);
  return data as User[];
};

/**
 * Get active technicians (lightweight)
 */
export const getTechnicians = async (): Promise<User[]> => {
  const { data, error } = await supabase
    .from('users')
    .select(USER_SELECT_LIGHTWEIGHT)
    .eq('role', UserRole.TECHNICIAN)
    .eq('is_active', true)
    .order('name');

  if (error) throw new Error(error.message);
  return data as User[];
};

/**
 * Get all accountants (lightweight)
 */
export const getAccountants = async (): Promise<User[]> => {
  const { data, error } = await supabase
    .from('users')
    .select(USER_SELECT_LIGHTWEIGHT)
    .eq('role', UserRole.ACCOUNTANT)
    .eq('is_active', true);

  if (error) {
    return [];
  }
  return data as User[];
};

/**
 * Get all admins and supervisors (lightweight)
 */
export const getAdminsAndSupervisors = async (): Promise<User[]> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(USER_SELECT_LIGHTWEIGHT)
      .in('role', [UserRole.ADMIN, UserRole.SUPERVISOR])
      .eq('is_active', true);

    if (error) {
      return [];
    }
    return data as User[];
  } catch (_e) {
    return [];
  }
};

/**
 * Create a new user
 */
export const createUser = async (userData: Partial<User> & { password?: string }): Promise<User> => {
  // Secure two-step user creation process
  // Step 1: Prepare - registers intent tied to admin's auth.uid()
  const { data: pendingId, error: prepareError } = await supabase.rpc('prepare_user_creation', {
    p_email: userData.email,
  });

  if (prepareError) throw new Error(prepareError.message);
  if (!pendingId) throw new Error('Failed to prepare user creation');

  // Step 2: Create auth user in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: userData.email!,
    password: userData.password || 'temp123',
  });

  if (authError) throw new Error(authError.message);
  if (!authData.user) throw new Error('Failed to create auth user');

  // Step 3: Complete - verifies pending request and creates user record
  const { data: userId, error: completeError } = await supabase.rpc('complete_user_creation', {
    p_pending_id: pendingId,
    p_auth_id: authData.user.id,
    p_name: userData.name,
    p_email: userData.email,
    p_role: userData.role || UserRole.TECHNICIAN,
    p_is_active: userData.is_active ?? true,
  });

  if (completeError) throw new Error(completeError.message);

  // Step 4: Fetch and return the created user
  const { data, error } = await supabase
    .from('users')
    .select()
    .eq('user_id', userId)
    .single();

  if (error) throw new Error(error.message);
  return data as User;
};

/**
 * Update an existing user
 */
export const updateUser = async (userId: string, updates: Partial<User> & { password?: string }): Promise<User> => {
  // Extract password from updates (passwords are in Supabase Auth, not users table)
  const { password, ...userUpdates } = updates;
  
  // Update user profile in users table (without password)
  const { data, error } = await supabase
    .from('users')
    .update(userUpdates)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  
  // If password was provided, update it via Supabase Auth
  if (password) {
    const { data: userData } = await supabase
      .from('users')
      .select('auth_id')
      .eq('user_id', userId)
      .single();
    
    if (userData?.auth_id) {
      const { error: authError } = await supabase.auth.updateUser({
        password: password
      });
      
      if (authError) {
        /* Silently ignore */
      }
    }
  }
  
  return data as User;
};
