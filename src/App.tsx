/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  User, 
  signOut 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  onSnapshot, 
  query, 
  where, 
  Timestamp,
  orderBy,
  limit,
  getDocFromServer
} from 'firebase/firestore';
import { auth, db } from './firebase';
import axios from 'axios';
import { format, formatDistanceToNow, isPast, parseISO, differenceInHours } from 'date-fns';
import { 
  Bell, 
  Settings, 
  LogOut, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  RefreshCw,
  Clock,
  BookOpen,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface UserSettings {
  canvasUrl: string;
  apiToken: string;
  notificationThresholds: number[];
}

interface Assignment {
  id: string;
  name: string;
  due_at: string | null;
  course_id: string;
  html_url: string;
  context_name?: string; // Added from todo endpoint
}

interface TrackedAssignment {
  assignmentId: string;
  courseId: string;
  courseName: string;
  name: string;
  dueAt: Timestamp;
  userId: string;
  notifiedThresholds: number[];
}

// --- Components ---

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' }>(
  ({ className, variant = 'primary', ...props }, ref) => {
    const variants = {
      primary: 'bg-black text-white hover:bg-zinc-800 shadow-sm',
      secondary: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200',
      outline: 'border border-zinc-200 bg-transparent hover:bg-zinc-50',
      ghost: 'bg-transparent hover:bg-zinc-100 text-zinc-600',
    };
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-50',
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm', className)}>
    {children}
  </div>
);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [trackedAssignments, setTrackedAssignments] = useState<Record<string, TrackedAssignment>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Auth & Initial Data ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (!currentUser) {
        setIsLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // Test connection to Firestore
  useEffect(() => {
    if (isAuthReady && user) {
      const testConnection = async () => {
        try {
          await getDocFromServer(doc(db, 'test', 'connection'));
        } catch (error) {
          if (error instanceof Error && error.message.includes('the client is offline')) {
            console.error("Please check your Firebase configuration.");
            setError("Firebase connection error. Check your configuration.");
          }
        }
      };
      testConnection();
    }
  }, [isAuthReady, user]);

  // Fetch Settings
  useEffect(() => {
    if (user) {
      const settingsRef = doc(db, 'users', user.uid, 'settings', 'current');
      const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
        if (docSnap.exists()) {
          setSettings(docSnap.data() as UserSettings);
        } else {
          setShowSettings(true);
        }
        setIsLoading(false);
      }, (err) => {
        console.error("Settings fetch error:", err);
        setError("Failed to fetch settings.");
      });
      return unsubscribe;
    }
  }, [user]);

  // Fetch Tracked Assignments
  useEffect(() => {
    if (user) {
      const assignmentsRef = collection(db, 'users', user.uid, 'assignments');
      const unsubscribe = onSnapshot(assignmentsRef, (snapshot) => {
        const tracked: Record<string, TrackedAssignment> = {};
        snapshot.docs.forEach((doc) => {
          tracked[doc.id] = doc.data() as TrackedAssignment;
        });
        setTrackedAssignments(tracked);
      });
      return unsubscribe;
    }
  }, [user]);

  // --- Canvas API Logic ---
  const fetchCanvasData = useCallback(async () => {
    if (!settings || !user) return;
    setIsRefreshing(true);
    setError(null);

    try {
      // 1. Fetch active courses
      const coursesResponse = await axios.post('/api/canvas/proxy', {
        canvasUrl: settings.canvasUrl,
        apiToken: settings.apiToken,
        endpoint: '/courses',
        params: { enrollment_state: 'active', per_page: 50 }
      });

      const courses = coursesResponse.data;
      if (!Array.isArray(courses)) throw new Error("Invalid courses data received");

      const allUpcomingAssignments: Assignment[] = [];

      // 2. Fetch assignments for each course (using bucket=future)
      // We use Promise.all to fetch in parallel for speed
      const assignmentPromises = courses.map(async (course: any) => {
        try {
          const res = await axios.post('/api/canvas/proxy', {
            canvasUrl: settings.canvasUrl,
            apiToken: settings.apiToken,
            endpoint: `/courses/${course.id}/assignments`,
            params: { bucket: 'future', per_page: 50 }
          });
          
          return (res.data || []).map((a: any) => ({
            ...a,
            context_name: course.name || course.course_code || 'Unknown Course'
          }));
        } catch (e) {
          console.warn(`Failed to fetch assignments for course ${course.id}`, e);
          return [];
        }
      });

      const results = await Promise.all(assignmentPromises);
      results.forEach(courseAssignments => {
        allUpcomingAssignments.push(...courseAssignments);
      });

      // 3. Also fetch from todo endpoint as a fallback for non-assignment items or items not in 'future' bucket
      try {
        const todoResponse = await axios.post('/api/canvas/proxy', {
          canvasUrl: settings.canvasUrl,
          apiToken: settings.apiToken,
          endpoint: '/users/self/todo',
        });
        
        const todos = todoResponse.data || [];
        todos.forEach((item: any) => {
          if (item.assignment && !allUpcomingAssignments.find(a => a.id.toString() === item.assignment.id.toString())) {
            allUpcomingAssignments.push({
              ...item.assignment,
              context_name: item.context_name || 'Todo Item'
            });
          }
        });
      } catch (e) {
        console.warn("Todo fetch failed, continuing with course assignments", e);
      }

      // Sort by due date
      allUpcomingAssignments.sort((a, b) => {
        if (!a.due_at) return 1;
        if (!b.due_at) return -1;
        return parseISO(a.due_at).getTime() - parseISO(b.due_at).getTime();
      });

      setAssignments(allUpcomingAssignments);

      // Sync with Firestore
      for (const assignment of allUpcomingAssignments) {
        if (assignment.due_at) {
          const assignmentRef = doc(db, 'users', user.uid, 'assignments', assignment.id.toString());
          const existing = trackedAssignments[assignment.id.toString()];
          
          if (!existing) {
            await setDoc(assignmentRef, {
              assignmentId: assignment.id.toString(),
              courseId: assignment.course_id.toString(),
              courseName: assignment.context_name,
              name: assignment.name,
              dueAt: Timestamp.fromDate(parseISO(assignment.due_at)),
              userId: user.uid,
              notifiedThresholds: []
            });
          }
        }
      }
    } catch (err: any) {
      console.error("Canvas fetch error:", err);
      setError(err.response?.data?.message || "Failed to fetch assignments from Canvas. Please check your URL and Token.");
    } finally {
      setIsRefreshing(false);
    }
  }, [settings, user, trackedAssignments]);

  useEffect(() => {
    if (settings && user && assignments.length === 0) {
      fetchCanvasData();
    }
  }, [settings, user, fetchCanvasData, assignments.length]);

  // --- Notification Logic ---
  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    const checkDeadlines = () => {
      if (!settings) return;
      const thresholds = settings.notificationThresholds || [24, 1]; // Default 24h and 1h

      (Object.values(trackedAssignments) as TrackedAssignment[]).forEach(async (tracked) => {
        const dueDate = tracked.dueAt.toDate();
        if (isPast(dueDate)) return;

        const hoursLeft = differenceInHours(dueDate, new Date());
        
        for (const threshold of thresholds) {
          if (hoursLeft <= threshold && !tracked.notifiedThresholds.includes(threshold)) {
            // Send notification
            new Notification(`Assignment Due Soon!`, {
              body: `[${tracked.courseName}] ${tracked.name} is due in ${hoursLeft} hours.`,
              icon: '/vite.svg'
            });

            // Update notified thresholds
            const assignmentRef = doc(db, 'users', user!.uid, 'assignments', tracked.assignmentId);
            await setDoc(assignmentRef, {
              ...tracked,
              notifiedThresholds: [...tracked.notifiedThresholds, threshold]
            });
          }
        }
      });
    };

    const interval = setInterval(checkDeadlines, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [trackedAssignments, settings, user]);

  // --- Handlers ---
  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login error:", err);
      setError("Failed to sign in.");
    }
  };

  const handleLogout = () => signOut(auth);

  const saveSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const canvasUrl = formData.get('canvasUrl') as string;
    const apiToken = formData.get('apiToken') as string;

    try {
      await setDoc(doc(db, 'users', user.uid, 'settings', 'current'), {
        userId: user.uid,
        canvasUrl,
        apiToken,
        notificationThresholds: [24, 1]
      });
      setShowSettings(false);
      setError(null);
    } catch (err) {
      console.error("Save settings error:", err);
      setError("Failed to save settings.");
    }
  };

  // --- Render Helpers ---
  if (!isAuthReady || (user && isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <RefreshCw className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8 text-center"
        >
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900">Hanyang Canvas Tracker</h1>
            <p className="text-zinc-500">한양대학교 학생들을 위한 과제 관리 도구. Canvas 과제를 동기화하고 실시간 알림을 받으세요.</p>
          </div>
          <Card className="space-y-6">
            <div className="flex justify-center">
              <div className="rounded-full bg-zinc-100 p-4">
                <Bell className="h-12 w-12 text-zinc-900" />
              </div>
            </div>
            <Button onClick={handleLogin} className="w-full py-6 text-lg">
              Sign in with Google
            </Button>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-black p-1.5">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Hanyang Canvas Tracker</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)}>
              <Settings className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
            <div className="ml-2 flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="h-5 w-5 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon className="h-4 w-4" />
              )}
              <span className="text-xs font-medium">{user.displayName?.split(' ')[0]}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6 flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600"
          >
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </motion.div>
        )}

        {/* Dashboard Content */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column: Stats & Actions */}
          <div className="space-y-6 lg:col-span-1">
            <Card className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Overview</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-2xl font-bold">{assignments.length}</p>
                  <p className="text-xs text-zinc-500">Pending Tasks</p>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-emerald-600">
                    {(Object.values(trackedAssignments) as TrackedAssignment[]).filter(a => isPast(a.dueAt.toDate())).length}
                  </p>
                  <p className="text-xs text-zinc-500">Completed</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                className="w-full gap-2" 
                onClick={fetchCanvasData}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                {isRefreshing ? 'Syncing...' : 'Sync Now'}
              </Button>
            </Card>

            <Card className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Quick Tips</h2>
              <ul className="space-y-3 text-sm text-zinc-600">
                <li className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span>Notifications are sent 24h and 1h before deadlines.</span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span>Keep this tab open for real-time alerts.</span>
                </li>
              </ul>
            </Card>
          </div>

          {/* Right Column: Assignment List */}
          <div className="space-y-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-tight">Upcoming Assignments</h2>
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Calendar className="h-4 w-4" />
                <span>{format(new Date(), 'MMM d, yyyy')}</span>
              </div>
            </div>

            <div className="space-y-4">
              {assignments.length === 0 && !isRefreshing ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white py-12 text-center">
                  <div className="mb-4 rounded-full bg-zinc-50 p-4">
                    <CheckCircle2 className="h-8 w-8 text-zinc-300" />
                  </div>
                  <p className="text-zinc-500">All caught up! No upcoming assignments found.</p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {assignments.map((assignment, idx) => (
                    <motion.div
                      key={assignment.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <Card className="group relative flex flex-col gap-4 transition-all hover:border-zinc-300 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                              {assignment.context_name}
                            </span>
                          </div>
                          <h3 className="font-semibold text-zinc-900">{assignment.name}</h3>
                          <div className="flex items-center gap-4 text-xs text-zinc-500">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>
                                {assignment.due_at 
                                  ? format(parseISO(assignment.due_at), 'MMM d, h:mm a')
                                  : 'No deadline'}
                              </span>
                            </div>
                            {assignment.due_at && (
                              <div className={cn(
                                "font-medium",
                                differenceInHours(parseISO(assignment.due_at), new Date()) < 24 ? "text-orange-600" : "text-zinc-500"
                              )}>
                                {formatDistanceToNow(parseISO(assignment.due_at), { addSuffix: true })}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a 
                            href={assignment.html_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
              onClick={() => settings && setShowSettings(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md"
            >
              <Card className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold tracking-tight">Hanyang Canvas Setup</h2>
                  <p className="text-sm text-zinc-500">Connect your Hanyang University Canvas account to start tracking assignments.</p>
                </div>
                <form onSubmit={saveSettings} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Canvas URL</label>
                    <input 
                      name="canvasUrl"
                      required
                      placeholder="https://learning.hanyang.ac.kr/"
                      defaultValue={settings?.canvasUrl || "https://learning.hanyang.ac.kr/"}
                      className="w-full rounded-lg border border-zinc-200 px-4 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">API Access Token</label>
                    <input 
                      name="apiToken"
                      type="password"
                      required
                      placeholder="Paste your token here"
                      defaultValue={settings?.apiToken}
                      className="w-full rounded-lg border border-zinc-200 px-4 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                    />
                    <p className="text-[10px] text-zinc-400">
                      Find this in Canvas: Account &gt; Settings &gt; New Access Token
                    </p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    {settings && (
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setShowSettings(false)}>
                        Cancel
                      </Button>
                    )}
                    <Button type="submit" className="flex-1">
                      Save & Connect
                    </Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
