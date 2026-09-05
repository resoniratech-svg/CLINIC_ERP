import React, { useEffect, useState } from 'react';
import { doctorsApi } from '../../api';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { DoctorTransferModal } from './DoctorTransferModal';
import { useToast } from '../../context/ToastContext';
import { Stethoscope, UserMinus, Search, Clock, Calendar, DollarSign, Award } from 'lucide-react';

export const DoctorsListPage = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoctorForTransfer, setSelectedDoctorForTransfer] = useState(null);

  const { showToast } = useToast();

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const res = await doctorsApi.getDoctors();
      if (res.success) {
        setDoctors(res.data || []);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch doctors registry', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const filteredDoctors = doctors.filter(
    (d) =>
      d.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.specialization?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.doctor_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-blue-600" />
            <span>Doctor Governance & Schedule Matrix</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Active medical consultants, OPD timings, consultation tiers, and resignation transfer protocols
          </p>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search doctors by name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <LoadingSpinner label="Loading clinical registry..." />
        ) : filteredDoctors.length === 0 ? (
          <EmptyState
            title="No doctors found"
            description="No medical practitioners match your search criteria."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Consultant Doctor</th>
                  <th className="py-3.5 px-4">Specialization</th>
                  <th className="py-3.5 px-4">OPD Schedule</th>
                  <th className="py-3.5 px-4">Consultation Fees</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Resignation Transfer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredDoctors.map((doc) => (
                  <tr key={doc.doctor_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">Dr. {doc.full_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {doc.doctor_code} • {doc.qualification || 'MBBS'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-medium text-slate-800">{doc.specialization}</span>
                      <span className="text-[11px] text-slate-400 block">{doc.experience_years} yrs exp</span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{doc.start_time?.slice(0, 5)} - {doc.end_time?.slice(0, 5)}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                        {doc.working_days}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono">
                      <div className="font-semibold text-slate-900">New: ₹{doc.new_consultation_fee}</div>
                      <div className="text-[11px] text-slate-500">Renew: ₹{doc.renewal_consultation_fee} | Follow: ₹{doc.followup_consultation_fee}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge variant={doc.status}>{doc.status}</Badge>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {doc.status === 'active' ? (
                        <button
                          onClick={() => setSelectedDoctorForTransfer(doc)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition-colors cursor-pointer border border-red-200"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                          <span>Resign & Transfer</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">Inactive (Transferred)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DoctorTransferModal
        isOpen={!!selectedDoctorForTransfer}
        onClose={() => setSelectedDoctorForTransfer(null)}
        sourceDoctor={selectedDoctorForTransfer}
        activeDoctors={doctors.filter((d) => d.status === 'active')}
        onTransferSuccess={fetchDoctors}
      />
    </div>
  );
};
