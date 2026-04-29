// Governance Timeline Component - Read-Only Audit Trail UI
// Displays governance history for transparency and compliance

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Shield,
  UserCheck,
  XCircle,
  CheckCircle,
  Clock,
  FileText,
  AlertTriangle,
  Eye
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface GovernanceEvent {
  id: string;
  timestamp: string;
  action: string;
  actorUserId: number;
  actorName?: string;
  entityType: string;
  entityId: string;
  metadata: {
    snapshot?: any;
    approvedAction?: string;
    approvedPowers?: string[];
    protectors?: Array<{
      id: string;
      fullName: string;
      powers: string[];
    }>;
    error?: string;
    [key: string]: any;
  };
}

interface GovernanceTimelineProps {
  entityType: "trust" | "family_office" | "foundation" | "dao_wrapper";
  entityId: string;
  className?: string;
}

export function GovernanceTimeline({
  entityType,
  entityId,
  className = ""
}: GovernanceTimelineProps) {
  const [events, setEvents] = useState<GovernanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchGovernanceHistory();
  }, [entityType, entityId]);

  const fetchGovernanceHistory = async () => {
    try {
      const response = await fetch(
        `/api/${entityType}s/${entityId}/governance/history`
      );
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error('Failed to fetch governance history:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleEventExpansion = (eventId: string) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedEvents(newExpanded);
  };

  const getEventIcon = (action: string) => {
    switch (action) {
      case 'GOVERNANCE_ASSIGNMENT_CREATE':
        return <UserCheck className="h-4 w-4 text-green-500" />;
      case 'GOVERNANCE_APPROVAL':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'GOVERNANCE_BLOCKED_ATTEMPT':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'POLICY_SNAPSHOT_GENERATED':
        return <Shield className="h-4 w-4 text-purple-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getEventBadgeVariant = (action: string) => {
    switch (action) {
      case 'GOVERNANCE_ASSIGNMENT_CREATE':
        return 'default';
      case 'GOVERNANCE_APPROVAL':
        return 'secondary';
      case 'GOVERNANCE_BLOCKED_ATTEMPT':
        return 'destructive';
      case 'POLICY_SNAPSHOT_GENERATED':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const formatEventDescription = (event: GovernanceEvent) => {
    switch (event.action) {
      case 'GOVERNANCE_ASSIGNMENT_CREATE':
        return `Trust Protector assigned: ${event.metadata.protectors?.[0]?.fullName || 'Unknown'}`;
      case 'GOVERNANCE_APPROVAL':
        return `Approved ${event.metadata.approvedAction} with powers: ${event.metadata.approvedPowers?.join(', ')}`;
      case 'GOVERNANCE_BLOCKED_ATTEMPT':
        return `Blocked ${event.metadata.blockedAction}: ${event.metadata.error}`;
      case 'POLICY_SNAPSHOT_GENERATED':
        return `Policy snapshot generated for ${event.metadata.snapshot?.action}`;
      default:
        return event.action.replace(/_/g, ' ').toLowerCase();
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Governance Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Governance Timeline
          <Badge variant="outline" className="ml-auto">
            {events.length} events
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No governance events recorded yet.</p>
          </div>
        ) : (
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {events.map((event, index) => (
                <div key={event.id}>
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      {getEventIcon(event.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={getEventBadgeVariant(event.action)}>
                          {event.action.replace(/_/g, ' ')}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm mb-2">
                        {formatEventDescription(event)}
                      </p>
                      {event.actorName && (
                        <p className="text-xs text-muted-foreground mb-2">
                          by {event.actorName}
                        </p>
                      )}

                      {/* Expandable Details */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleEventExpansion(event.id)}
                        className="p-0 h-auto text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        {expandedEvents.has(event.id) ? 'Hide' : 'Show'} details
                      </Button>

                      {expandedEvents.has(event.id) && (
                        <div className="mt-2 p-3 bg-muted rounded-md">
                          <pre className="text-xs overflow-x-auto">
                            {JSON.stringify(event.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                  {index < events.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// API Route for fetching governance history
// File: /api/trusts/[trustId]/governance/history/route.ts
/*
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq, desc } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { auditLogs, governanceAssignments, workflowClientProfiles } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

async function getAuthedUserId(): Promise<number | null> {
  const token = cookies().get('auth-token')?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  return payload?.userId || null;
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ trustId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  if (!trustId) return NextResponse.json({ error: "Missing trustId" }, { status: 400 });

  const db = await getDb();

  // Verify ownership
  const trustRows = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.id, trustId), eq(trusts.userId, userId)))
    .limit(1);

  if (trustRows.length === 0) {
    return NextResponse.json({ error: "Trust not found" }, { status: 404 });
  }

  // Get governance events
  const events = await db
    .select({
      id: auditLogs.id,
      timestamp: auditLogs.timestamp,
      action: auditLogs.action,
      actorUserId: auditLogs.actorUserId,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      metadata: auditLogs.metadata,
      // Join for actor names
      actorName: sql<string>`COALESCE(${users.fullName}, ${workflowClientProfiles.fullName}, 'System')`,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorUserId, users.id))
    .leftJoin(
      workflowClientProfiles,
      sql`${auditLogs.metadata}->'$.clientProfileId' = ${workflowClientProfiles.id}`
    )
    .where(
      and(
        eq(auditLogs.entityType, "governance_assignment"),
        sql`${auditLogs.metadata}->'$.entityId' = ${trustId}`
      )
    )
    .orderBy(desc(auditLogs.timestamp))
    .limit(100);

  return NextResponse.json({
    events: events.map(event => ({
      ...event,
      metadata: JSON.parse(event.metadata || '{}'),
    }))
  });
}
*/

// Usage in Smart Trust wizard:
/*
import { GovernanceTimeline } from '@/components/governance-timeline';

function TrustGovernanceStep() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6">
        <GovernanceTimeline
          entityType="trust"
          entityId={trustId}
          className="max-w-2xl"
        />
      </div>
    </div>
  );
}
*/
