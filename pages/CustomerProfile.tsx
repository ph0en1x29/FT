import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Customer, Job, UserRole } from '../types';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { generateCustomerAnalysis } from '../services/geminiService';
import { 
  ArrowLeft, MapPin, Phone, Mail, Calendar, DollarSign, 
  TrendingUp, AlertCircle, BrainCircuit, Wrench, CheckCircle, Clock
} from 'lucide-react';

interface CustomerProfileProps {
  currentUserRole: UserRole;
}

const CustomerProfile: React.FC<CustomerProfileProps> = ({ currentUserRole }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [generatingAI, setGeneratingAI] = useState(false);

  useEffect(() => {
    loadCustomerData();
  }, [id]);

  const loadCustomerData = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      // Get customer
      const customers = await MockDb.getCustomers();
      const foundCustomer = customers.find(c => c.customer_id === id);
      setCustomer(foundCustomer || null);

      // Get all jobs for this customer
      const currentUser = await MockDb.getCurrentUser();
      if (currentUser) {
        const allJobs = await MockDb.getJobs(currentUser);
        const customerJobs = allJobs.filter(j => j.customer_id === id);
        setJobs(customerJobs.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ));
      }
    } catch (error) {
      console.error('Error loading customer:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAnalysis = async () => {
    if (!customer || jobs.length === 0) return;
    
    setGeneratingAI(true);
    try {
      const analysis = await generateCustomerAnalysis(customer, jobs);
      setAiAnalysis(analysis);
    } catch (error) {
      console.error('AI Analysis error:', error);
      setAiAnalysis('Unable to generate analysis at this time.');
    } finally {
      setGeneratingAI(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading customer profile...</div>;
  }

  if (!customer) {
    return <div className="p-8 text-center text-red-500">Customer not found</div>;
  }

  // Calculate stats
  const totalJobs = jobs.length;
  const completedJobs = jobs.filter(j => j.status === 'Completed' || j.status === 'Invoiced').length;
  const totalRevenue = jobs.reduce((acc, job) => {
    const partsCost = job.parts_used.reduce((sum, p) => sum + (p.sell_price_at_time * p.quantity), 0);
    return acc + partsCost + 150; // Add base labor
  }, 0);
  
  const lastService = jobs[0];
  const avgResponseTime = jobs.filter(j => j.arrival_time).length > 0
    ? jobs.filter(j => j.arrival_time).reduce((acc, j) => {
        const created = new Date(j.created_at).getTime();
        const arrived = new Date(j.arrival_time!).getTime();
        return acc + ((arrived - created) / (1000 * 60 * 60));
      }, 0) / jobs.filter(j => j.arrival_time).length
    : 0;

  // Most common issues
  const issueFrequency: { [key: string]: number } = {};
  jobs.forEach(job => {
    const title = job.title.toLowerCase();
    const key = title.includes('ac') || title.includes('air') ? 'AC/HVAC' :
                title.includes('heat') ? 'Heating' :
                title.includes('plumb') || title.includes('pipe') ? 'Plumbing' :
                title.includes('electric') ? 'Electrical' :
                'General Maintenance';
    issueFrequency[key] = (issueFrequency[key] || 0) + 1;
  });

  const topIssues = Object.entries(issueFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Customer Profile</h1>
      </div>

      {/* Customer Info Card */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm p-6 border border-blue-100">
        <div className="flex justify-between items-start">
          <div className="space-y-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{customer.name}</h2>
              <p className="text-sm text-slate-500">Customer ID: {customer.customer_id.slice(0, 8)}</p>
            </div>
            
            <div className="space-y-2 text-slate-700">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>{customer.address}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-600" />
                <a href={`tel:${customer.phone}`} className="hover:underline">{customer.phone}</a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <a href={`mailto:${customer.email}`} className="hover:underline">{customer.email}</a>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-blue-600">{totalJobs}</p>
              <p className="text-xs text-slate-500">Total Jobs</p>
            </div>
            <div className="bg-white rounded-lg p-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-green-600">${totalRevenue.toLocaleString()}</p>
              <p className="text-xs text-slate-500">Total Revenue</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Stats */}
        <div className="space-y-6">
          
          {/* Service Stats */}
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-blue-600" /> Service Stats
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-slate-700">Completed</span>
                </div>
                <span className="font-bold text-green-600">{completedJobs}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-slate-700">Avg Response</span>
                </div>
                <span className="font-bold text-blue-600">{avgResponseTime.toFixed(1)}h</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-slate-700">Avg Job Value</span>
                </div>
                <span className="font-bold text-purple-600">
                  ${totalJobs > 0 ? Math.round(totalRevenue / totalJobs) : 0}
                </span>
              </div>
            </div>
          </div>

          {/* Top Issues */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-600" /> Common Issues
            </h3>
            {topIssues.length > 0 ? (
              <div className="space-y-2">
                {topIssues.map(([issue, count], idx) => (
                  <div key={issue} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                    <span className="text-sm text-slate-700">#{idx + 1} {issue}</span>
                    <span className="text-xs font-bold text-slate-500">{count}x</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No service history yet</p>
            )}
          </div>

          {/* Last Service */}
          {lastService && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" /> Last Service
              </h3>
              <div className="space-y-2 text-sm">
                <p className="font-medium text-slate-800">{lastService.title}</p>
                <p className="text-slate-500">{lastService.description}</p>
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs text-slate-400">
                    {new Date(lastService.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                    lastService.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {lastService.status}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - History & AI */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* AI Analysis */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl shadow-sm p-6 border border-purple-100">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-1">
                  <BrainCircuit className="w-5 h-5 text-purple-600" /> AI Customer Analysis
                </h3>
                <p className="text-xs text-slate-500">
                  Get intelligent insights about service patterns and trends
                </p>
              </div>
              {!aiAnalysis && (
                <button
                  onClick={handleGenerateAnalysis}
                  disabled={generatingAI || jobs.length === 0}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {generatingAI ? 'Analyzing...' : 'Generate Analysis'}
                </button>
              )}
            </div>

            {aiAnalysis ? (
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="prose prose-sm max-w-none text-slate-700">
                  {aiAnalysis.split('\n').map((line, idx) => (
                    <p key={idx} className="mb-2">{line}</p>
                  ))}
                </div>
                <button
                  onClick={() => setAiAnalysis('')}
                  className="mt-4 text-xs text-purple-600 hover:underline"
                >
                  Generate New Analysis
                </button>
              </div>
            ) : jobs.length === 0 ? (
              <div className="bg-white rounded-lg p-4 text-center text-slate-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No service history to analyze yet</p>
              </div>
            ) : null}
          </div>

          {/* Service History */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-bold text-slate-800 mb-4">Service History</h3>
            
            {jobs.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {jobs.map(job => (
                  <div
                    key={job.job_id}
                    onClick={() => navigate(`/jobs/${job.job_id}`)}
                    className="p-4 border border-slate-200 rounded-lg hover:shadow-md hover:border-blue-300 transition cursor-pointer group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-800 group-hover:text-blue-600">
                          {job.title}
                        </h4>
                        <p className="text-sm text-slate-500 line-clamp-1">{job.description}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ml-3 ${
                        job.status === 'Completed' || job.status === 'Invoiced' ? 'bg-green-100 text-green-700' :
                        job.status === 'In Progress' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {job.status}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(job.created_at).toLocaleDateString()}
                      </span>
                      {job.parts_used.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Wrench className="w-3 h-3" />
                          {job.parts_used.length} parts used
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <Wrench className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No service history yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerProfile;