import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldCheck, User } from "lucide-react";

interface IdentityStripProps {
  clientId?: string | null;
  trustId?: string | null;
  entityPublicId?: string | null;
  isAuthenticated?: boolean;
  showWalletStatus?: boolean;
}

export function IdentityStrip({
  clientId,
  trustId,
  entityPublicId,
  isAuthenticated = false,
  showWalletStatus = false
}: IdentityStripProps) {
  const [isAssigning, setIsAssigning] = useState(false);

  const handleAssignPublicId = async () => {
    if (!trustId) {
      alert('No trust ID available to assign public ID');
      return;
    }

    console.log('Assigning public ID for trust:', trustId);
    setIsAssigning(true);
    try {
      const response = await fetch(`/api/trusts/${encodeURIComponent(trustId)}/assign-public-id`, {
        method: 'POST',
        credentials: 'include',
      });

      console.log('Assign ID response:', response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('Assign ID success:', data);
        alert(`Public ID assigned successfully: ${data.trust.publicId}`);
        // Refresh the page to reload the identity data
        window.location.reload();
      } else {
        const error = await response.json();
        console.error('Assign ID error:', error);
        alert(`Failed to assign public ID: ${error.error}`);
      }
    } catch (error) {
      console.error('Error assigning public ID:', error);
      alert('Failed to assign public ID. Please try again.');
    } finally {
      setIsAssigning(false);
    }
  };
  return (
    <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-300">Identity Status</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Auth Status */}
          <Badge variant={isAuthenticated ? "default" : "secondary"} className="flex items-center gap-1">
            {isAuthenticated ? (
              <>
                <ShieldCheck className="h-3 w-3" />
                Signed In
              </>
            ) : (
              <>
                <Shield className="h-3 w-3" />
                Read-Only
              </>
            )}
          </Badge>

          {/* Wallet Status (if shown) */}
          {showWalletStatus && (
            <Badge variant="outline" className="text-xs">
              Wallet Connected
            </Badge>
          )}
        </div>
      </div>

      {/* ID Display */}
      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
        {clientId && (
          <div className="bg-slate-800/50 rounded px-2 py-1">
            <span className="text-slate-400">CID:</span>
            <span className="ml-1 font-mono text-slate-200">{clientId.slice(0, 8)}...</span>
          </div>
        )}

        {trustId && (
          <div className="bg-slate-800/50 rounded px-2 py-1">
            <span className="text-slate-400">TID:</span>
            <span className="ml-1 font-mono text-slate-200">{trustId.slice(0, 8)}...</span>
          </div>
        )}

        {entityPublicId ? (
          <div className="bg-slate-800/50 rounded px-2 py-1">
            <span className="text-slate-400">Entity ID:</span>
            <span className="ml-1 font-mono text-slate-200">{entityPublicId}</span>
          </div>
        ) : (
          <div className="bg-amber-950/50 border border-amber-500/50 rounded px-2 py-1">
            <span className="text-amber-400">Entity ID:</span>
            <span className="ml-1 text-amber-300">Not assigned</span>
            <button
              onClick={handleAssignPublicId}
              disabled={isAssigning}
              className="ml-2 text-xs text-cyan-300 hover:text-cyan-200 underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAssigning ? 'Assigning...' : 'Assign ID'}
            </button>
          </div>
        )}
      </div>

      {/* Auth Explanation */}
      {!isAuthenticated && (
        <div className="mt-2 text-xs text-amber-400/80 bg-amber-950/20 rounded px-2 py-1 border border-amber-500/20">
          <strong>Wallet access</strong> allows viewing gated features.
          <strong className="ml-1">Signing in</strong> enables saving and retrieving records.
        </div>
      )}
    </div>
  );
}
