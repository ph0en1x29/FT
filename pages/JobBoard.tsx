import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Job, JobStatus, User } from '../types_with_invoice_tracking';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { Briefcase, Calendar, MapPin, User as UserIcon } from 'lucide-react';

interface JobBoardProps {
  currentUser: User;
}

const JobBoard: React.FC<JobBoardProps> = ({ currentUser }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchJobs = async () => {
      const data = await MockDb.getJobs(currentUser);
      setJobs(data);
    };
    fetchJobs();
  }, [currentUser]);

  const getStatusColor = (status: JobStatus) => {
    switch(status) {
      case JobStatus.NEW: return 'bg-blue-100 text-blue-800';
      case JobStatus.ASSIGNED: return 'bg-indigo-100 text-indigo-800';
      case JobStatus.IN_PROGRESS: return 'bg-amber-100 text-amber-800';
      case JobStatus.AWAITING_FINALIZATION: return 'bg-purple-100 text-purple-800';
      case JobStatus.COMPLETED: return 'bg-green-100 text-green-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">
          {currentUser.role === 'technician' ? 'My Jobs' : 'Job Board'}
        </h1>
        {(currentUser.role === 'admin' || currentUser.role === 'technician') && (
          <button 
            onClick={() => navigate('/jobs/new')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition"
          >
            + New Job
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {jobs.map(job => (
          <div 
            key={job.job_id} 
            onClick={() => navigate(`/jobs/${job.job_id}`)}
            className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition cursor-pointer group"
          >
            <div className="flex justify-between items-start mb-3">
              <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wide ${getStatusColor(job.status)}`}>
                {job.status}
              </span>
              {job.priority === 'Emergency' && (
                <span className="text-xs font-bold text-red-600 animate-pulse">EMERGENCY</span>
              )}
            </div>
            
            <h3 className="font-bold text-lg text-slate-800 group-hover:text-blue-600 mb-1">{job.title}</h3>
            <p className="text-slate-500 text-sm mb-4 line-clamp-2">{job.description}</p>
            
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span className="truncate">{job.customer.address}</span>
              </div>
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-slate-400" />
                <span>{job.customer.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>{new Date(job.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        ))}

        {jobs.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400">
            <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No jobs found.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobBoard;