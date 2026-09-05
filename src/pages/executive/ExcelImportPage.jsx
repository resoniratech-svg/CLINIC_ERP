import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { executiveApi } from '../../api';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  Download,
  PhoneForwarded,
  History,
  FileText,
  Trash2,
  Send,
  RefreshCw
} from 'lucide-react';

export const ExcelImportPage = () => {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setFileName(uploadedFile.name);
    setFile(uploadedFile);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (!data || data.length === 0) {
          showToast('The uploaded sheet is empty or contains no valid rows', 'warning');
          setParsedRows([]);
          return;
        }

        // Robust helper to match keys regardless of case, spaces, underscores, or dots
        const getVal = (row, patterns) => {
          const keys = Object.keys(row);
          for (const k of keys) {
            const normKey = k.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            for (const p of patterns) {
              const normPat = p.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
              if (normKey === normPat) {
                const val = row[k];
                return val !== undefined && val !== null ? String(val).trim() : '';
              }
            }
          }
          return '';
        };

        // Normalize column keys flexibly (case & format agnostic)
        const formatted = data.map((row, index) => {
          const name = getVal(row, [
            'name', 'full name', 'patient', 'patient name', 'customer name',
            'patient_name', 'lead name', 'lead_name', 'contact name', 'contact_name'
          ]) || `Contact #${index + 1}`;

          let rawMobile = getVal(row, [
            'number', 'mobile number', 'mobile_number', 'phone', 'phone number',
            'phone_number', 'contact number', 'contact_number', 'contact no',
            'phone_no', 'mobile_no', 'mobile no', 'phone no', 'mobile', 'phone',
            'contact', 'cell', 'cell number', 'cell_number', 'cell phone'
          ]);
          let mobile = rawMobile.replace(/\D/g, '');
          if (mobile.length === 12 && mobile.startsWith('91')) {
            mobile = mobile.slice(2);
          } else if (mobile.length === 11 && mobile.startsWith('0')) {
            mobile = mobile.slice(1);
          }

          const problem = getVal(row, [
            'problem', 'ailment', 'aliment', 'reason', 'requirement',
            'complaint', 'disease', 'illness', 'issue', 'condition', 'diagnose', 'diagnosis', 'treatment'
          ]);

          const ageStr = getVal(row, ['age', 'patient age', 'patient_age']);
          const age = ageStr ? parseInt(ageStr) || null : null;

          const rawGender = getVal(row, ['gender', 'sex']).toLowerCase();
          let gender = 'male';
          if (rawGender.startsWith('f') || rawGender === 'female' || rawGender === 'woman' || rawGender === 'girl') {
            gender = 'female';
          } else if (rawGender === 'other' || rawGender === 'transgender') {
            gender = 'other';
          } else if (rawGender.startsWith('m') || rawGender === 'male' || rawGender === 'man' || rawGender === 'boy') {
            gender = 'male';
          }

          const village = getVal(row, ['village', 'town', 'city', 'locality', 'location', 'address', 'area']);
          const mandal = getVal(row, ['mandal', 'district', 'subdistrict', 'tehsil', 'taluk', 'taluka']);
          const campaign = getVal(row, ['campaign', 'source', 'lead source', 'lead_source', 'campaign name', 'campaign_name']) || 'Excel Campaign Import';
          const remarks = getVal(row, ['remarks', 'notes', 'comment', 'comments', 'description', 'remark']);
          const sl_no = getVal(row, [
            'sl.no', 'sl no', 'sl_no', 'slno', 'serial no', 'serial number',
            'serial_no', 'sr no', 's.no', 's no', 's_no', 'id'
          ]) || `SL-${index + 1}`;

          return {
            serial_no: sl_no,
            patient_name: name,
            mobile_number: mobile,
            problem,
            age,
            gender,
            village,
            mandal,
            campaign,
            remarks
          };
        }).filter((r) => r.mobile_number && r.mobile_number.length >= 10);

        if (formatted.length === 0) {
          showToast('No records with valid 10-digit mobile numbers found in the sheet', 'error');
        } else {
          showToast(`Parsed ${formatted.length} contact records successfully from sheet`, 'info');
        }
        setParsedRows(formatted);
      } catch (err) {
        showToast('Error reading Excel spreadsheet: ' + err.message, 'error');
      }
    };
    reader.readAsBinaryString(uploadedFile);
  };

  const handleDownloadSample = () => {
    const sampleData = [
      {
        'Sl. No.': 'SL-101',
        'Patient Name': 'Ramesh Kumar',
        'Mobile Number': '9876543210',
        'Age': 45,
        'Gender': 'male',
        'Village': 'Gandhi Nagar',
        'Mandal': 'Karimnagar',
        'Problem': 'Chronic Joint Pain',
        'Campaign': 'August Followup',
        'Remarks': 'Preferred call in evening'
      },
      {
        'Sl. No.': 'SL-102',
        'Patient Name': 'Sunita Devi',
        'Mobile Number': '9876543211',
        'Age': 38,
        'Gender': 'female',
        'Village': 'Subhash Nagar',
        'Mandal': 'Karimnagar',
        'Problem': 'Skin Allergies & Psoriasis',
        'Campaign': 'August Followup',
        'Remarks': 'Referred by newspaper ad'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Outbound_Contacts');
    XLSX.writeFile(wb, 'Sample_Outbound_Calling_Template.xlsx');
  };

  const handleSubmitImport = async () => {
    if (parsedRows.length === 0) {
      showToast('Please upload a sheet with at least 1 valid contact record', 'warning');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        file_name: fileName || 'outbound_data.xlsx',
        records: parsedRows
      };

      const res = await executiveApi.importOutboundLeads(payload);
      if (res.success && res.data) {
        setImportResult(res.data);
        showToast(`Successfully imported ${res.data.valid_records} calling records! (${res.data.duplicate_records} duplicates skipped)`, 'success');
        setParsedRows([]);
        setFile(null);
      } else {
        showToast('Failed to import outbound records', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Error processing outbound import', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Outbound Excel Data Import
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
              Batch Upload
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Upload Excel (.xlsx / .xls / .csv) files • Automatic duplicate mobile validation against registered patients and existing calling leads.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadSample}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Download Sample Template</span>
          </button>

          <Link
            to="/executive/outbound/queue"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <PhoneForwarded className="w-3.5 h-3.5" />
            <span>Go to Calling Queue</span>
          </Link>
        </div>
      </div>

      {/* 2. Upload Zone Card */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-xs text-center space-y-4">
        <div className="max-w-md mx-auto space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <Upload className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Select or Drop Contact Spreadsheet
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Supports .xlsx, .xls, .csv formatted files containing patient names, mobile numbers, and campaign tags.
            </p>
          </div>

          <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 cursor-pointer transition-all">
            <FileSpreadsheet className="w-4 h-4" />
            <span>Browse Excel File</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {fileName && (
            <div className="flex items-center justify-center gap-2 text-xs font-mono text-slate-700 pt-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              <span className="font-bold">{fileName}</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Import Success Feedback Banner */}
      {importResult && (
        <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3 text-xs">
          <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Batch #{importResult.batch_id} Imported Successfully!</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-white rounded-xl border border-emerald-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Rows Processed</span>
              <span className="text-lg font-bold text-slate-900 font-mono">{importResult.total_records}</span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-emerald-100">
              <span className="text-[10px] text-emerald-700 font-bold uppercase block">Valid Leads Created</span>
              <span className="text-lg font-bold text-emerald-700 font-mono">{importResult.valid_records}</span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-emerald-100">
              <span className="text-[10px] text-amber-700 font-bold uppercase block">Duplicates Filtered</span>
              <span className="text-lg font-bold text-amber-700 font-mono">{importResult.duplicate_records}</span>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Link
              to="/executive/outbound/queue"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              Start Calling These Leads Now →
            </Link>
          </div>
        </div>
      )}

      {/* 4. Parsed Rows Preview Table */}
      {parsedRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4 p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Parsed Contact Preview ({parsedRows.length} Contacts)
              </h3>
              <p className="text-xs text-slate-500">
                Review the contact records before uploading to the live calling database.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setParsedRows([]);
                  setFile(null);
                  setFileName('');
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                <span>Clear</span>
              </button>

              <button
                onClick={handleSubmitImport}
                disabled={loading}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all cursor-pointer"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Confirm & Upload {parsedRows.length} Leads</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Patient Name</th>
                  <th className="py-2.5 px-3">Mobile Number</th>
                  <th className="py-2.5 px-3">Age / Gender</th>
                  <th className="py-2.5 px-3">Location</th>
                  <th className="py-2.5 px-3">Problem / Campaign</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {parsedRows.slice(0, 50).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">{row.serial_no || idx + 1}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{row.patient_name}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{row.mobile_number}</td>
                    <td className="py-2.5 px-3 text-slate-600 capitalize">
                      {row.age ? `${row.age} yrs • ` : ''}{row.gender}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {row.village || row.mandal ? `${row.village || ''} ${row.mandal ? `(${row.mandal})` : ''}` : '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-800 truncate max-w-xs">{row.problem || 'General Checkup'}</div>
                      <div className="text-[10px] text-slate-400">{row.campaign}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsedRows.length > 50 && (
            <div className="text-[11px] text-slate-400 text-center pt-2">
              Showing first 50 rows of {parsedRows.length} total rows.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
