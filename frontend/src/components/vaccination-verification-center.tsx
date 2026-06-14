'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, Clock, AlertCircle, Shield } from 'lucide-react';

interface VaccinationVerificationCenterProps {
  walletAddress: string;
}

export function VaccinationVerificationCenter({ walletAddress }: VaccinationVerificationCenterProps) {
  const [verifications] = useState<any[]>([]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-400" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Vaccination Verification Center</h2>
      
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-500/20 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-green-400">0</div>
          <div className="text-green-200 text-sm">Verified</div>
        </div>
        <div className="bg-yellow-500/20 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-yellow-400">0</div>
          <div className="text-yellow-200 text-sm">Pending</div>
        </div>
        <div className="bg-red-500/20 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-red-400">0</div>
          <div className="text-red-200 text-sm">Rejected</div>
        </div>
      </div>

      <div className="space-y-4">
        {verifications.length === 0 ? (
          <div className="text-center py-8 text-green-200">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No vaccination verifications yet</p>
          </div>
        ) : (
          verifications.map((verification) => (
            <div
              key={verification.id}
              className="bg-white/10 rounded-lg p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                {getStatusIcon(verification.status)}
                <div>
                  <p className="text-white font-medium">{verification.vaccineType}</p>
                  <p className="text-green-200 text-sm">
                    Submitted: {new Date(verification.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm ${
                verification.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                verification.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                'bg-yellow-500/20 text-yellow-400'
              }`}>
                {verification.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
