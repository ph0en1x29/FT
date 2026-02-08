import { Customer,Job,JobMedia,JobPriority,JobStatus,Part,SignatureEntry,User,UserRole } from '../types';

// Simple "hashing" for prototype
const hashPassword = (pwd: string) => `hashed_${pwd}`;

// Initial Seed Data
const USERS: User[] = [
  { 
    user_id: 'u1', 
    name: 'Alice Admin', 
    role: UserRole.ADMIN, 
    email: 'admin@example.com', 
    password_hash: hashPassword('admin123'),
    is_active: true 
  },
  { 
    user_id: 'u2', 
    name: 'Tom Tech', 
    role: UserRole.TECHNICIAN, 
    email: 'tom@fieldpro.com', 
    password_hash: hashPassword('tech123'),
    is_active: true 
  },
  { 
    user_id: 'u3', 
    name: 'Sarah Accountant', 
    role: UserRole.ACCOUNTANT, 
    email: 'sarah@fieldpro.com', 
    password_hash: hashPassword('money123'),
    is_active: true 
  },
  { 
    user_id: 'u4', 
    name: 'Bob Builder', 
    role: UserRole.TECHNICIAN, 
    email: 'bob@fieldpro.com',
    password_hash: hashPassword('tech123'), 
    is_active: true 
  },
  { 
    user_id: 'u5', 
    name: 'Mike Mechanic', 
    role: UserRole.TECHNICIAN, 
    email: 'mike@fieldpro.com',
    password_hash: hashPassword('tech123'), 
    is_active: true 
  },
];

const CUSTOMERS: Customer[] = [
  { customer_id: 'c1', name: 'Acme Corp HQ', address: '123 Business Rd, Tech City', phone: '555-0123', email: 'facility@acme.com' },
  { customer_id: 'c2', name: 'Mrs. Higgins', address: '45 Maple Lane, Suburbia', phone: '555-9876', email: 'higgins@email.com' },
];

const PARTS: Part[] = [
  { part_id: 'p1', part_name: 'HVAC Filter A4', part_code: 'FLT-A4', category: 'Filters', cost_price: 5, sell_price: 15, warranty_months: 6, stock_quantity: 50 },
  { part_id: 'p2', part_name: 'Compressor Unit X1', part_code: 'CMP-X1', category: 'Motors', cost_price: 200, sell_price: 450, warranty_months: 24, stock_quantity: 5 },
  { part_id: 'p3', part_name: 'Control Board v2', part_code: 'PCB-V2', category: 'Electronics', cost_price: 50, sell_price: 120, warranty_months: 12, stock_quantity: 12 },
  { part_id: 'p4', part_name: 'PVC Pipe 2ft', part_code: 'PVC-02', category: 'Pipes', cost_price: 2, sell_price: 8, warranty_months: 0, stock_quantity: 100 },
];

const JOBS: Job[] = [
  {
    job_id: 'j1',
    customer_id: 'c1',
    customer: CUSTOMERS[0],
    title: 'AC Unit Malfunction',
    description: 'Server room AC is making a loud rattling noise. Temperature rising.',
    priority: JobPriority.EMERGENCY,
    status: JobStatus.ASSIGNED,
    assigned_technician_id: 'u2',
    assigned_technician_name: 'Tom Tech',
    created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    scheduled_date: new Date().toISOString(),
    notes: ['Initial report: noise started 2 hours ago.'],
    parts_used: [],
    media: [],
  },
  {
    job_id: 'j2',
    customer_id: 'c2',
    customer: CUSTOMERS[1],
    title: 'Annual Maintenance',
    description: 'Regular checkup for home heating system.',
    priority: JobPriority.LOW,
    status: JobStatus.NEW,
    assigned_technician_id: '',
    created_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    notes: [],
    parts_used: [],
    media: [],
  },
  {
    job_id: 'j3',
    customer_id: 'c1',
    customer: CUSTOMERS[0],
    title: 'Filter Replacement',
    description: 'Quarterly filter change for main office.',
    priority: JobPriority.MEDIUM,
    status: JobStatus.COMPLETED,
    assigned_technician_id: 'u2',
    assigned_technician_name: 'Tom Tech',
    created_at: new Date(Date.now() - 400000000).toISOString(),
    completion_time: new Date(Date.now() - 100000).toISOString(),
    notes: ['All filters changed.'],
    parts_used: [
      { job_part_id: 'jp1', job_id: 'j3', part_id: 'p1', part_name: 'HVAC Filter A4', quantity: 4, sell_price_at_time: 15 }
    ],
    media: [],
    technician_signature: {
      signed_by_name: 'Tom Tech',
      signed_at: new Date(Date.now() - 100000).toISOString(),
      signature_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' // placeholder
    }
  },
];

// Service Layer
export const MockDb = {
  // AUTHENTICATION
  login: async (email: string, password: string): Promise<User> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const user = USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) throw new Error('Invalid email or password');
    if (!user.is_active) throw new Error('Account is deactivated');
    
    // Simple hash check
    if (user.password_hash !== hashPassword(password)) {
      throw new Error('Invalid email or password');
    }

    // Return user without hash
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...safeUser } = user;
    return safeUser as User;
  },

  // USER MANAGEMENT
  getUsers: async () => {
    await new Promise(resolve => setTimeout(resolve, 200));
    // Return users (safely)
    return USERS.map(u => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password_hash, ...safe } = u;
      return safe as User;
    });
  },

  getTechnicians: async () => {
    return USERS.filter(u => u.role === UserRole.TECHNICIAN && u.is_active).map(u => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password_hash, ...safe } = u;
        return safe as User;
    });
  },

  createUser: async (userData: Partial<User> & { password?: string }) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    if (USERS.some(u => u.email === userData.email)) {
      throw new Error("Email already exists");
    }

    const newUser: User = {
      user_id: `u${Date.now()}`,
      name: userData.name || 'New User',
      email: userData.email!,
      role: userData.role || UserRole.TECHNICIAN,
      is_active: userData.is_active ?? true,
      password_hash: hashPassword(userData.password || 'password123'),
      created_at: new Date().toISOString()
    };

    USERS.push(newUser);
    return newUser;
  },

  updateUser: async (userId: string, updates: Partial<User> & { password?: string }) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    const idx = USERS.findIndex(u => u.user_id === userId);
    if (idx === -1) throw new Error("User not found");

    // Destructure password from updates to avoid saving it to the user object
    const { password: rawPassword, ...cleanUpdates } = updates;
    const updatedUser = { ...USERS[idx], ...cleanUpdates };
    
    // Handle password change if provided
    if (rawPassword) {
      updatedUser.password_hash = hashPassword(rawPassword);
    }

    USERS[idx] = updatedUser;
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...safe } = updatedUser;
    return safe as User;
  },

  // CORE ENTITIES
  
  getParts: async () => [...PARTS],

  getCustomers: async () => [...CUSTOMERS],

  createCustomer: async (customerData: Partial<Customer>) => {
    const newId = `c${Date.now()}`;
    const newCustomer: Customer = {
      customer_id: newId,
      name: customerData.name || 'New Customer',
      phone: customerData.phone || '',
      email: customerData.email || '',
      address: customerData.address || '',
      notes: customerData.notes || ''
    };
    CUSTOMERS.push(newCustomer);
    return newCustomer;
  },
  
  getJobs: async (user: User) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const jobs = [...JOBS];
    
    if (user.role === UserRole.TECHNICIAN) {
      return jobs.filter(j => j.assigned_technician_id === user.user_id);
    }
    return jobs;
  },

  getJobById: async (jobId: string) => {
    return JOBS.find(j => j.job_id === jobId) || null;
  },

  createJob: async (jobData: Partial<Job>) => {
    const newId = `j${Date.now()}`;
    const customer = CUSTOMERS.find(c => c.customer_id === jobData.customer_id);
    if (!customer) throw new Error("Customer not found");

    const newJob: Job = {
        job_id: newId,
        customer_id: jobData.customer_id!,
        customer: customer,
        title: jobData.title || 'New Job',
        description: jobData.description || '',
        priority: jobData.priority || JobPriority.MEDIUM,
        status: jobData.status || JobStatus.NEW,
        assigned_technician_id: jobData.assigned_technician_id || '',
        assigned_technician_name: jobData.assigned_technician_name,
        created_at: new Date().toISOString(),
        notes: [],
        parts_used: [],
        media: [],
        ...jobData
    } as Job;

    JOBS.push(newJob);
    return newJob;
  },

  assignJob: async (jobId: string, technicianId: string, technicianName: string) => {
    const job = JOBS.find(j => j.job_id === jobId);
    if (job) {
        job.assigned_technician_id = technicianId;
        job.assigned_technician_name = technicianName;
        job.status = JobStatus.ASSIGNED;
    }
    return job;
  },

  updateJobStatus: async (jobId: string, status: JobStatus) => {
    const job = JOBS.find(j => j.job_id === jobId);
    if (job) {
      job.status = status;
      if (status === JobStatus.IN_PROGRESS && !job.arrival_time) {
        job.arrival_time = new Date().toISOString();
      }
      if (status === JobStatus.COMPLETED) {
        job.completion_time = new Date().toISOString();
      }
    }
    return job;
  },

  addNote: async (jobId: string, note: string) => {
    const job = JOBS.find(j => j.job_id === jobId);
    if (job) {
      job.notes.push(`${new Date().toLocaleTimeString()}: ${note}`);
    }
    return job;
  },

  addPartToJob: async (jobId: string, partId: string, quantity: number, customPrice?: number) => {
    const job = JOBS.find(j => j.job_id === jobId);
    const part = PARTS.find(p => p.part_id === partId);
    
    if (job && part) {
      if (part.stock_quantity >= quantity) {
        part.stock_quantity -= quantity;
        job.parts_used.push({
          job_part_id: Math.random().toString(36).substr(2, 9),
          job_id: jobId,
          part_id: partId,
          part_name: part.part_name,
          quantity,
          sell_price_at_time: customPrice !== undefined ? customPrice : part.sell_price
        });
      } else {
        throw new Error('Insufficient stock');
      }
    }
    return job;
  },

  addMedia: async (jobId: string, media: JobMedia) => {
     const job = JOBS.find(j => j.job_id === jobId);
     if (job) {
       job.media.push(media);
     }
     return job;
  },

  signJob: async (jobId: string, type: 'technician' | 'customer', signerName: string, signatureDataUrl: string) => {
    const job = JOBS.find(j => j.job_id === jobId);
    if (job) {
      const entry: SignatureEntry = {
        signed_by_name: signerName,
        signed_at: new Date().toISOString(),
        signature_url: signatureDataUrl
      };

      if (type === 'technician') {
        job.technician_signature = entry;
      } else {
        job.customer_signature = entry;
      }
    }
    return job;
  }
};