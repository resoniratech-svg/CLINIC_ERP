import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Modal } from '../../components/common/Modal';
import { callCenterApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, FileCheck, X, FileUp } from 'lucide-react';

export const ExcelImportModal = ({ isOpen, onClose, onImportSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileStats, setFileStats] = useState(null);
  const [parsedRecords, setParsedRecords] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultStats, setResultStats] = useState(null);
  const fileInputRef = useRef(null);

  const { showToast } = useToast();

  const handleReset = () => {
    setSelectedFile(null);
    setFileStats(null);
    setParsedRecords([]);
    setResultStats(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileNameLower = file.name.toLowerCase();
    const isValidExt = validExtensions.some((ext) => fileNameLower.endsWith(ext));

    if (!isValidExt) {
      showToast('Please select an Excel (.xlsx, .xls) or CSV (.csv) file', 'warning');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
    setParsing(true);
    setResultStats(null);

    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          throw new Error('No worksheets found in the file');
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (rawJson.length === 0) {
          throw new Error('The selected spreadsheet does not contain any data rows');
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

        // Standardize column keys
        const mappedRecords = rawJson
          .map((row, index) => {
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
            const campaign = getVal(row, ['campaign', 'source', 'lead source', 'lead_source', 'campaign name', 'campaign_name']) || 'Outbound Campaign';
            const remarks = getVal(row, ['remarks', 'notes', 'comment', 'comments', 'description', 'remark']) || 'Imported lead';

            return {
              patient_name: name,
              mobile_number: mobile,
              problem,
              age,
              gender,
              village: village || null,
              campaign,
              remarks,
            };
          })
          .filter((r) => r.mobile_number.length > 0);

        if (mappedRecords.length === 0) {
          throw new Error('No valid records with phone/mobile numbers found in the file');
        }

        setParsedRecords(mappedRecords);
        setFileStats({
          name: file.name,
          size: (file.size / 1024).toFixed(1) + ' KB',
          totalRows: rawJson.length,
          validRows: mappedRecords.length,
        });
        showToast(`Parsed ${mappedRecords.length} records ready for validation`, 'info');
      } catch (err) {
        showToast(err.message || 'Failed to read spreadsheet', 'error');
        handleReset();
      } finally {
        setParsing(false);
      }
    };

    reader.onerror = () => {
      showToast('Error reading the selected file from disk', 'error');
      setParsing(false);
      handleReset();
    };

    reader.readAsArrayBuffer(file);
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile || parsedRecords.length === 0) {
      showToast('Please select a valid Excel or CSV file with lead data', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await callCenterApi.importOutboundLeads({
        file_name: selectedFile.name,
        records: parsedRecords,
      });

      if (res.success) {
        setResultStats(res.data);
        showToast(
          `Import complete: ${res.data.valid_records} valid leads imported, ${res.data.duplicate_records} duplicates skipped`,
          'success',
          5000
        );
        if (onImportSuccess) onImportSuccess();
      }
    } catch (err) {
      showToast(err.message || 'Failed to process outbound import', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        handleReset();
        onClose();
      }}
      title="Import Outbound Calling Excel / CSV Leads"
      maxWidth="max-w-2xl"
    >
      {!resultStats ? (
        <form onSubmit={handleImportSubmit} className="space-y-4 text-xs text-slate-700">
          {/* Information Notice */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3">
            <FileSpreadsheet className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="space-y-1 text-blue-950 leading-relaxed">
              <div className="font-bold">Automated Duplicate Phone Verification</div>
              <p>
                The backend inspects existing hospital patients and previously imported leads. Duplicate phone numbers are automatically excluded from the Executive Calling Queue.
              </p>
            </div>
          </div>

          {/* File Picker Zone */}
          <div className="space-y-2">
            <label className="block font-bold text-slate-800 uppercase text-[11px]">
              Select Excel or CSV File *
            </label>

            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                selectedFile
                  ? 'border-blue-400 bg-blue-50/30'
                  : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />

              {parsing ? (
                <div className="flex flex-col items-center gap-2 py-2 text-slate-500">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  <span className="font-medium">Reading and parsing spreadsheet contents...</span>
                </div>
              ) : selectedFile ? (
                <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-blue-200 shadow-2xs">
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                      <FileCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{fileStats?.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {fileStats?.size} • {fileStats?.validRows} valid lead rows detected
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReset();
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2 py-2">
                  <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                    <FileUp className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="font-bold text-blue-700 hover:underline">Click to browse</span> or drag and drop your file
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Supported: Microsoft Excel (.xlsx, .xls) and CSV (.csv)
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Parsed Preview Table */}
          {parsedRecords.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 uppercase">
                <span>Spreadsheet Preview (First {Math.min(parsedRecords.length, 3)} records)</span>
                <span className="text-blue-600 font-mono">{parsedRecords.length} Ready</span>
              </div>

              <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden text-[11px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2 px-3">Lead Name</th>
                      <th className="py-2 px-3">Mobile</th>
                      <th className="py-2 px-3">Age/Gender</th>
                      <th className="py-2 px-3">Location</th>
                      <th className="py-2 px-3">Campaign</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60">
                    {parsedRecords.slice(0, 3).map((r, i) => (
                      <tr key={i} className="hover:bg-white/60">
                        <td className="py-2 px-3 font-bold text-slate-900">{r.patient_name}</td>
                        <td className="py-2 px-3 font-mono text-slate-700">{r.mobile_number}</td>
                        <td className="py-2 px-3 capitalize text-slate-600">
                          {r.age ? `${r.age}y` : '—'} / {r.gender || '—'}
                        </td>
                        <td className="py-2 px-3 text-slate-600">{r.village || '—'}</td>
                        <td className="py-2 px-3 text-slate-600 truncate max-w-[120px]">{r.campaign}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                handleReset();
                onClose();
              }}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedFile || parsedRecords.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validating & Importing...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Validate & Import Queue</span>
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        /* Result Summary Screen */
        <div className="space-y-4 text-center py-4 text-xs text-slate-700">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Batch Import Successfully Processed</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Batch #{resultStats.batch_id} created and logged in database
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Processed</span>
              <span className="text-lg font-bold text-slate-900 font-mono">{resultStats.total_records}</span>
            </div>
            <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200">
              <span className="text-emerald-700 block text-[10px] uppercase font-bold">Valid Imported</span>
              <span className="text-lg font-bold text-emerald-700 font-mono">{resultStats.valid_records}</span>
            </div>
            <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200">
              <span className="text-amber-700 block text-[10px] uppercase font-bold">Duplicates Skipped</span>
              <span className="text-lg font-bold text-amber-700 font-mono">{resultStats.duplicate_records}</span>
            </div>
          </div>

          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="mt-4 px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl cursor-pointer"
          >
            Done & Return to Queue
          </button>
        </div>
      )}
    </Modal>
  );
};
