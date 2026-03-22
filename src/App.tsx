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
import { format, formatDistanceToNow, isPast, parseISO, differenceInHours, addHours, addDays } from 'date-fns';
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
  Megaphone,
  Plus,
  Trash2,
  Users,
  Pencil,
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
  pushoverAppToken?: string;
  pushoverUserKey?: string;
  notificationThresholds: number[];
}

interface Announcement {
  id: string;
  title: string;
  message: string;
  posted_at: string;
  html_url: string;
  context_name: string;
}

interface CustomEvent {
  id: string;
  title: string;
  date: string;       // ISO string
  description: string;
  category: string;   // e.g. '팀플', '기타'
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

// Utility for Character Image
function getCharacterImage(hoursLeft: number) {
  if (hoursLeft < 0) return '/characters/heart.png';
  if (hoursLeft <= 3) return '/characters/angel.png';
  if (hoursLeft <= 24) return '/characters/angry.png';
  if (hoursLeft <= 72) return '/characters/crying.png';
  return '/characters/normal.png';
}

function getCharacterFileName(hoursLeft: number) {
  if (hoursLeft < 0) return 'heart.png';
  if (hoursLeft <= 3) return 'angel.png';
  if (hoursLeft <= 24) return 'angry.png';
  if (hoursLeft <= 72) return 'crying.png';
  return 'normal.png';
}

function getCharacterMessage(hoursLeft: number) {
  if (hoursLeft < 0) return '제출 완료 또는 기한 만료';
  if (hoursLeft <= 3) return '초인적인 힘이 필요할 때!';
  if (hoursLeft <= 24) return '마감 임박! 서두르세요!';
  if (hoursLeft <= 72) return '슬슬 시작해야 합니다.';
  return '아직 여유롭습니다 :)';
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
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [trackedAssignments, setTrackedAssignments] = useState<Record<string, TrackedAssignment>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'setup' | 'macos'>('setup');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [customEvents, setCustomEvents] = useState<CustomEvent[]>(() => {
    try {
      const stored = localStorage.getItem('kirothon_custom_events');
      if (stored) return JSON.parse(stored) as CustomEvent[];
    } catch {}
    // Demo seed
    return [{
      id: 'ce-demo-1',
      title: '소프트웨어공학 팀플 회의',
      date: addDays(new Date(), 3).toISOString(),
      description: '도서관 6층 스터디룸 2호실, 기능 분담 회의',
      category: '팀플'
    }];
  });
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', date: '', description: '', category: '팀플' });
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<CustomEvent>>({});

  const nextAssignment = assignments.length > 0 ? assignments[0] : null;

  const macosScript = `
import requests
import os
import sys
from datetime import datetime

# ==========================================
# 1. 설정
# ==========================================
CANVAS_DOMAIN = '${settings?.canvasUrl || 'https://learning.hanyang.ac.kr'}'
ACCESS_TOKEN = '${settings?.apiToken || 'YOUR_ACCESS_TOKEN_HERE'}'

def send_macos_notification(title, message):
    """macOS osascript를 사용하여 네이티브 알림을 보냅니다."""
    command = f'display notification "{message}" with title "{title}" sound name "Glass"'
    os.system(f"osascript -e '{command}'")

def get_upcoming_assignments():
    """Canvas API를 호출하여 다가오는 할 일 목록을 가져옵니다."""
    endpoint = f"{CANVAS_DOMAIN}/api/v1/users/self/todo"
    headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}"
    }

    try:
        response = requests.get(endpoint, headers=headers, timeout=10)
        response.raise_for_status()
        
        todo_list = response.json()
        
        assignments = []
        for item in todo_list:
            if item.get('type') == 'assignment' and 'assignment' in item:
                assignment_data = item['assignment']
                due_at = assignment_data.get('due_at')
                if due_at:
                    assignments.append({
                        'name': assignment_data.get('name'),
                        'due_at': datetime.strptime(due_at, '%Y-%m-%dT%H:%M:%SZ')
                    })
        
        assignments.sort(key=lambda x: x['due_at'])
        return assignments

    except requests.exceptions.RequestException as e:
        print(f"❌ API 호출 중 에러 발생: {e}")
        return None
    except Exception as e:
        print(f"❌ 알 수 없는 에러 발생: {e}")
        return None

def main():
    print(f"🚀 {CANVAS_DOMAIN}에서 과제 데이터를 가져오는 중...")
    assignments = get_upcoming_assignments()
    
    if assignments is None:
        send_macos_notification("Canvas 에러", "데이터를 가져오지 못했습니다. 토큰을 확인하세요.")
        return

    if not assignments:
        print("✅ 남은 과제가 없습니다!")
        send_macos_notification("Canvas 알림", "현재 남은 과제가 없습니다. 편히 쉬세요!")
    else:
        urgent = assignments[0]
        name = urgent['name']
        due_str = urgent['due_at'].strftime('%m월 %d일 %H:%M')
        message = f"가장 급한 과제: {name}\\n마감일: {due_str}"
        print(f"🔔 알림 전송: {message}")
        send_macos_notification("Canvas 마감 임박!", message)

if __name__ == "__main__":
    main()
`.trim();
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
    if (user && !isDemoMode) {
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
  }, [user, isDemoMode]);

  // --- Canvas API Logic ---
  const fetchCanvasData = useCallback(async (overrideDemoMode?: boolean | React.MouseEvent | undefined) => {
    const isDemo = typeof overrideDemoMode === 'boolean' ? overrideDemoMode : isDemoMode;
    if (!settings || !user) return;
    setIsRefreshing(true);
    setError(null);

    try {
      if (isDemo) {
        const now = new Date();
        const demoAssignments: Assignment[] = [
          {
            id: 'demo-1',
            name: '기계학습 중간고사 대체 과제',
            due_at: addHours(now, 2).toISOString(),
            course_id: 'c-1',
            context_name: '기계학습',
            html_url: '#',
          },
          {
            id: 'demo-2',
            name: '운영체제 5주차 동영상 강의 시청',
            due_at: addHours(now, 18).toISOString(),
            course_id: 'c-2',
            context_name: '운영체제',
            html_url: '#',
          },
          {
            id: 'demo-3',
            name: '소프트웨어공학 오프라인 시험 일정',
            due_at: addDays(now, 2).toISOString(),
            course_id: 'c-3',
            context_name: '소프트웨어공학',
            html_url: '#',
          },
          {
            id: 'demo-4',
            name: '알고리즘 챕터 3 실습 과제',
            due_at: addDays(now, 4).toISOString(),
            course_id: 'c-4',
            context_name: '알고리즘',
            html_url: '#',
          }
        ];
        setAssignments(demoAssignments);

        const demoAnnouncements: Announcement[] = [
          {
            id: 'anno-1',
            title: '휴강 및 보강 안내 (5/5)',
            message: '5월 5일 어린이날 휴강에 대한 보강은 5월 12일 야간에 진행됩니다.',
            posted_at: new Date().toISOString(),
            html_url: '#',
            context_name: '운영체제'
          },
          {
            id: 'anno-2',
            title: '기계학습 과제 2 관련 수정사항',
            message: '데이터셋 링크가 변경되었습니다. 최신 공지를 확인하세요.',
            posted_at: addHours(new Date(), -12).toISOString(),
            html_url: '#',
            context_name: '기계학습'
          }
        ];
        setAnnouncements(demoAnnouncements);
        
        const mockTracked: Record<string, TrackedAssignment> = {};
        demoAssignments.forEach(a => {
          mockTracked[a.id] = {
            assignmentId: a.id,
            courseId: a.course_id,
            courseName: a.context_name || 'Demo',
            name: a.name,
            dueAt: Timestamp.fromDate(parseISO(a.due_at!)),
            userId: user.uid,
            notifiedThresholds: []
          };
        });
        setTrackedAssignments(mockTracked);
        setIsRefreshing(false);
        return;
      }

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

      // 4. Fetch Announcements
      try {
        if (courses.length > 0) {
          const contextQuery = courses.map((c: any) => `context_codes[]=course_${c.id}`).join('&');
          const annoRes = await axios.post('/api/canvas/proxy', {
            canvasUrl: settings.canvasUrl,
            apiToken: settings.apiToken,
            endpoint: `/announcements?${contextQuery}`,
          });
          const rawAnnouncements = annoRes.data || [];
          
          const formattedAnnouncements = rawAnnouncements.map((an: any) => {
            const courseId = an.context_code ? an.context_code.replace('course_', '') : '';
            const courseObj = courses.find((c: any) => c.id.toString() === courseId);
            return {
              id: an.id,
              title: an.title,
              message: an.message,
              posted_at: an.posted_at,
              html_url: an.html_url,
              context_name: courseObj ? (courseObj.name || courseObj.course_code) : 'Unknown Course'
            };
          });

          formattedAnnouncements.sort((a: any, b: any) => parseISO(b.posted_at).getTime() - parseISO(a.posted_at).getTime());
          setAnnouncements(formattedAnnouncements.slice(0, 5));
        }
      } catch (e: any) {
        console.warn("Failed to fetch announcements", e);
      }

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
  }, [settings, user, trackedAssignments, isDemoMode]);

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
              icon: getCharacterImage(hoursLeft)
            });

            if (settings.pushoverAppToken && settings.pushoverUserKey) {
              axios.post('/api/pushover', {
                appToken: settings.pushoverAppToken,
                userKey: settings.pushoverUserKey,
                title: `과제 안내: ${getCharacterMessage(hoursLeft)}`,
                message: `과목명: ${tracked.courseName}\n과제명: ${tracked.name}\n남은 시간: ${hoursLeft}시간`,
                imageName: getCharacterFileName(hoursLeft),
              }).catch(console.error);
            }

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

  const saveCustomEvent = () => {
    if (!newEvent.title.trim() || !newEvent.date) return;
    const event: CustomEvent = {
      id: `ce-${Date.now()}`,
      title: newEvent.title.trim(),
      date: new Date(newEvent.date).toISOString(),
      description: newEvent.description.trim(),
      category: newEvent.category || '기타'
    };
    const updated = [...customEvents, event].sort(
      (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()
    );
    setCustomEvents(updated);
    localStorage.setItem('kirothon_custom_events', JSON.stringify(updated));
    setNewEvent({ title: '', date: '', description: '', category: '팀플' });
    setShowAddEvent(false);
  };

  const saveEditedEvent = () => {
    if (!editDraft.title?.trim() || !editDraft.date) return;
    const updated = customEvents.map(e =>
      e.id === editingEventId
        ? { ...e, ...editDraft, title: editDraft.title!.trim(), description: editDraft.description?.trim() ?? '' }
        : e
    ).sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
    setCustomEvents(updated);
    localStorage.setItem('kirothon_custom_events', JSON.stringify(updated));
    setEditingEventId(null);
    setEditDraft({});
  };

  const deleteCustomEvent = (id: string) => {
    const updated = customEvents.filter(e => e.id !== id);
    setCustomEvents(updated);
    localStorage.setItem('kirothon_custom_events', JSON.stringify(updated));
  };

  const saveSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const canvasUrl = formData.get('canvasUrl') as string;
    const apiToken = formData.get('apiToken') as string;
    const pushoverAppToken = formData.get('pushoverAppToken') as string || '';
    const pushoverUserKey = formData.get('pushoverUserKey') as string || '';

    try {
      await setDoc(doc(db, 'users', user.uid, 'settings', 'current'), {
        userId: user.uid,
        canvasUrl,
        apiToken,
        pushoverAppToken,
        pushoverUserKey,
        notificationThresholds: [24, 1]
      });
      setShowSettings(false);
      setError(null);
    } catch (err) {
      console.error("Save settings error:", err);
      setError("Failed to save settings.");
    }
  };

  const handleTestPushover = async () => {
    if (!settings?.pushoverAppToken || !settings?.pushoverUserKey) {
      alert("App Token과 User Key를 먼저 저장해주세요.");
      return;
    }
    
    let hoursLeft = 24;
    let label = '1일';
    let courseName = '테스트 과목';
    let assignName = '테스트 과제';

    if (isDemoMode && assignments.length > 0) {
      const picked = assignments[Math.floor(Math.random() * assignments.length)];
      courseName = picked.context_name || '데모 과목';
      assignName = picked.name;
      if (picked.due_at) {
        hoursLeft = differenceInHours(parseISO(picked.due_at), new Date());
      }
      label = `데모 데이터`;
    } else {
      const testOptions = [
        { hours: 72, label: '3일' },
        { hours: 24, label: '1일' },
        { hours: 3, label: '3시간' }
      ];
      const picked = testOptions[Math.floor(Math.random() * testOptions.length)];
      hoursLeft = picked.hours;
      label = picked.label;
      assignName = `${picked.label} 알림 테스트`;
    }

    try {
      await axios.post('/api/pushover', {
        appToken: settings.pushoverAppToken,
        userKey: settings.pushoverUserKey,
        title: `과제 안내: ${getCharacterMessage(hoursLeft)}`,
        message: `과목명: ${courseName}\n과제명: ${assignName}\n남은 시간: ${hoursLeft}시간`,
        imageName: getCharacterFileName(hoursLeft),
      });
      alert(`${label} 표정 알림 전송 완료! 폰을 확인해주세요.`);
    } catch (err) {
      console.error("Test pushover error:", err);
      alert("알림 전송 실패. Token과 Key를 다시 확인해주세요.");
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
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900">다했냥</h1>
            <p className="text-zinc-500">한양대학교 학생들을 위한 과제 알림 집사. Canvas 과제를 동기화하고 실시간 알림을 받으세요.</p>
          </div>
          <Card className="space-y-6">
            <div className="flex justify-center">
              <div className="rounded-3xl overflow-hidden drop-shadow-sm border-2 border-zinc-100">
                <img src="/characters/normal.png" alt="다했냥" className="h-24 w-24 object-cover" />
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

  const exams = assignments.filter((a) => a.name.match(/시험|고사|퀴즈|quiz|exam|midterm|final/i));
  const lectures = assignments.filter((a) => a.name.match(/동영상|강의|강좌|시청|video|lecture|e-learning|이러닝/i) && !a.name.match(/시험|고사|퀴즈|quiz|exam|midterm|final/i));
  const regularAssignments = assignments.filter((a) => !exams.includes(a) && !lectures.includes(a));

  const sections = [
    { id: 'exams', title: '시험 및 퀴즈', items: exams, icon: <BookOpen className="h-5 w-5 text-indigo-500" /> },
    { id: 'lectures', title: '동영상 강의', items: lectures, icon: <Clock className="h-5 w-5 text-blue-500" /> },
    { id: 'assignments', title: '일반 과제', items: regularAssignments, icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" /> }
  ];

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl overflow-hidden shadow-sm shrink-0">
              <img src="/characters/normal.png" alt="다했냥" className="h-8 w-8 object-cover" />
            </div>
            <span className="text-xl font-black tracking-tight">다했냥</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 mr-2 bg-zinc-100 p-1.5 rounded-lg border border-zinc-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Demo</span>
              <button
                onClick={() => {
                  const newMode = !isDemoMode;
                  setIsDemoMode(newMode);
                  fetchCanvasData(newMode);
                }}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2",
                  isDemoMode ? "bg-emerald-500" : "bg-zinc-300"
                )}
                role="switch"
                aria-checked={isDemoMode}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    isDemoMode ? "translate-x-4" : "translate-x-0"
                  )}
                />
              </button>
            </div>
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

        {/* Next Deadline Highlight */}
        {nextAssignment && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="relative overflow-hidden rounded-2xl bg-zinc-900 p-6 text-white shadow-xl sm:p-8">
              <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
                    <Bell className="h-3 w-3 text-orange-400" />
                    <span>Next Deadline</span>
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{nextAssignment.name}</h2>
                  <div className="flex items-center gap-4 text-sm text-zinc-400">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      <span>{format(parseISO(nextAssignment.due_at!), 'MMMM d, h:mm a')}</span>
                    </div>
                    <div className="rounded-full bg-orange-500/10 px-3 py-0.5 text-xs font-semibold text-orange-400">
                      {formatDistanceToNow(parseISO(nextAssignment.due_at!), { addSuffix: true })}
                    </div>
                  </div>
                </div>
                <a 
                  href={nextAssignment.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-zinc-900 transition-transform hover:scale-105 active:scale-95"
                >
                  Go to Assignment
                </a>
              </div>
              {/* Character Image Element */}
              <div className="absolute -right-8 -bottom-12 w-48 h-48 sm:w-80 sm:h-80 opacity-95 transition-transform hover:scale-105 pointer-events-none drop-shadow-2xl">
                <img src={getCharacterImage(nextAssignment.due_at ? differenceInHours(parseISO(nextAssignment.due_at), new Date()) : 100)} alt="character" className="w-full h-full object-contain drop-shadow-2xl" />
              </div>
            </div>
          </motion.div>
        )}

        {/* Dashboard Content */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column: Stats & Actions */}
          <div className="space-y-6 lg:col-span-1">
            <Card className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Overview</h2>
              {assignments.length === 0 ? (
                <p className="text-sm text-zinc-500">No pending tasks.</p>
              ) : (
                <div className="space-y-4">
                  {assignments.slice(0, 4).map((assignment, idx) => (
                    <div key={idx} className="flex flex-col gap-1 border-b border-zinc-100 pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{assignment.context_name}</span>
                      </div>
                      <a href={assignment.html_url} target="_blank" rel="noopener noreferrer" className="font-medium text-sm text-zinc-900 hover:text-blue-600 transition-colors line-clamp-2">
                        {assignment.name}
                      </a>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <Clock className="h-3 w-3" />
                        <span className={cn(
                          "font-medium",
                          assignment.due_at && differenceInHours(parseISO(assignment.due_at), new Date()) < 24 ? "text-orange-600" : ""
                        )}>
                          {assignment.due_at ? formatDistanceToNow(parseISO(assignment.due_at), { addSuffix: true }) : 'No deadline'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="pt-2">
                <Button 
                  variant="outline" 
                  className="w-full gap-2" 
                  onClick={fetchCanvasData}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                  {isRefreshing ? 'Syncing...' : 'Sync Now'}
                </Button>
              </div>
            </Card>

            <Card className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Recent Announcements</h2>
              {announcements.length === 0 ? (
                <p className="text-sm text-zinc-500">No recent announcements.</p>
              ) : (
                <div className="space-y-4">
                  {announcements.map((ann, idx) => (
                    <div key={idx} className="flex flex-col gap-1 border-b border-zinc-100 pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2">
                        <Megaphone className="h-3 w-3 text-orange-500 shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{ann.context_name}</span>
                      </div>
                      <a href={ann.html_url} target="_blank" rel="noopener noreferrer" className="font-medium text-sm text-zinc-900 hover:text-blue-600 transition-colors line-clamp-2">
                        {ann.title}
                      </a>
                      <span className="text-xs text-zinc-400">
                        {formatDistanceToNow(parseISO(ann.posted_at), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Right Column: Assignment List */}
          <div className="space-y-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-tight">Upcoming Tasks</h2>
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Calendar className="h-4 w-4" />
                <span>{format(new Date(), 'MMM d, yyyy')}</span>
              </div>
            </div>

            <div className="space-y-8">
              {assignments.length === 0 && !isRefreshing ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white py-12 text-center">
                  <div className="mb-4 rounded-full bg-zinc-50 p-4">
                    <CheckCircle2 className="h-8 w-8 text-zinc-300" />
                  </div>
                  <p className="text-zinc-500">All caught up! No upcoming tasks found.</p>
                </div>
              ) : (
                sections.map(section => section.items.length > 0 && (
                  <div key={section.id} className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
                       {section.icon}
                       <h3 className="text-lg font-bold text-zinc-900">{section.title}</h3>
                       <span className="ml-2 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">{section.items.length}</span>
                    </div>
                    <div className="space-y-4">
                      <AnimatePresence mode="popLayout">
                        {section.items.map((assignment, idx) => (
                          <motion.div
                            key={assignment.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                          >
                            <Card className="group relative flex flex-col gap-4 transition-all hover:border-zinc-300 sm:flex-row sm:items-center sm:justify-between p-4 sm:p-5">
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
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Custom Events Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-violet-500" />
                  <h3 className="text-lg font-bold text-zinc-900">직접 등록한 일정</h3>
                  <span className="ml-2 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">{customEvents.length}</span>
                </div>
                <button
                  onClick={() => setShowAddEvent(v => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-100 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  일정 추가
                </button>
              </div>

              <AnimatePresence>
                {showAddEvent && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    <Card className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 space-y-1">
                          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">제목</label>
                          <input
                            value={newEvent.title}
                            onChange={e => setNewEvent(v => ({ ...v, title: e.target.value }))}
                            placeholder="팀플 회의, 발표 준비 등"
                            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">카테고리</label>
                          <select
                            value={newEvent.category}
                            onChange={e => setNewEvent(v => ({ ...v, category: e.target.value }))}
                            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                          >
                            <option>팀플</option>
                            <option>발표</option>
                            <option>스터디</option>
                            <option>기타</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">날짜/시간</label>
                          <input
                            type="datetime-local"
                            value={newEvent.date}
                            onChange={e => setNewEvent(v => ({ ...v, date: e.target.value }))}
                            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">메모 (선택)</label>
                          <input
                            value={newEvent.description}
                            onChange={e => setNewEvent(v => ({ ...v, description: e.target.value }))}
                            placeholder="장소, 준비물 등"
                            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" className="flex-1" onClick={() => setShowAddEvent(false)}>취소</Button>
                        <Button className="flex-1" onClick={saveCustomEvent}>저장</Button>
                      </div>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {customEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white py-8 text-center">
                  <Users className="h-7 w-7 text-zinc-300 mb-2" />
                  <p className="text-sm text-zinc-500">등록된 일정이 없습니다.</p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {customEvents.map((ev, idx) => (
                    <motion.div
                      key={ev.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: idx * 0.04 }}
                    >
                      <Card className="flex flex-col gap-2 p-4 sm:p-5 transition-all hover:border-zinc-300">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">
                                {ev.category}
                              </span>
                            </div>
                            <h3 className="font-semibold text-zinc-900">{ev.title}</h3>
                            {ev.description && (
                              <p className="text-xs text-zinc-500 line-clamp-1">{ev.description}</p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-zinc-500">
                              <Clock className="h-3 w-3" />
                              <span>{format(parseISO(ev.date), 'MM월 dd일 HH:mm')}</span>
                              <span className={cn(
                                "font-medium",
                                differenceInHours(parseISO(ev.date), new Date()) < 24 ? "text-orange-600" : "text-zinc-400"
                              )}>
                                ({formatDistanceToNow(parseISO(ev.date), { addSuffix: true })})
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              if (editingEventId === ev.id) {
                                setEditingEventId(null);
                                setEditDraft({});
                              } else {
                                setEditingEventId(ev.id);
                                setEditDraft({
                                  title: ev.title,
                                  date: ev.date,
                                  description: ev.description,
                                  category: ev.category
                                });
                              }
                            }}
                            className={cn(
                              "shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                              editingEventId === ev.id
                                ? "bg-violet-100 text-violet-700"
                                : "text-zinc-300 hover:text-violet-500 hover:bg-violet-50"
                            )}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                        <AnimatePresence>
                          {editingEventId === ev.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-3">
                                <div className="col-span-2 space-y-1">
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">제목</label>
                                  <input
                                    value={editDraft.title ?? ''}
                                    onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))}
                                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">카테고리</label>
                                  <select
                                    value={editDraft.category ?? '팀플'}
                                    onChange={e => setEditDraft(d => ({ ...d, category: e.target.value }))}
                                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                                  >
                                    <option>팀플</option>
                                    <option>발표</option>
                                    <option>스터디</option>
                                    <option>기타</option>
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">날짜/시간</label>
                                  <input
                                    type="datetime-local"
                                    value={editDraft.date ? editDraft.date.slice(0, 16) : ''}
                                    onChange={e => setEditDraft(d => ({ ...d, date: new Date(e.target.value).toISOString() }))}
                                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                                  />
                                </div>
                                <div className="col-span-2 space-y-1">
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">메모</label>
                                  <input
                                    value={editDraft.description ?? ''}
                                    onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))}
                                    placeholder="장소, 준비물 등"
                                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                                  />
                                </div>
                              </div>
                              <div className="mt-3 flex gap-2">
                                <button
                                  onClick={() => { deleteCustomEvent(ev.id); setEditingEventId(null); }}
                                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors"
                                >
                                  삭제
                                </button>
                                <div className="flex-1" />
                                <button
                                  onClick={() => { setEditingEventId(null); setEditDraft({}); }}
                                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors"
                                >
                                  취소
                                </button>
                                <button
                                  onClick={saveEditedEvent}
                                  className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700 transition-colors"
                                >
                                  저장
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
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
              className="relative w-full max-w-2xl"
            >
              <Card className="overflow-hidden p-0">
                <div className="flex border-b border-zinc-100">
                  <button 
                    onClick={() => setActiveTab('setup')}
                    className={cn(
                      "flex-1 py-4 text-sm font-bold transition-colors",
                      activeTab === 'setup' ? "bg-zinc-50 text-zinc-900" : "text-zinc-400 hover:text-zinc-600"
                    )}
                  >
                    Canvas Setup
                  </button>
                  <button 
                    onClick={() => setActiveTab('macos')}
                    className={cn(
                      "flex-1 py-4 text-sm font-bold transition-colors",
                      activeTab === 'macos' ? "bg-zinc-50 text-zinc-900" : "text-zinc-400 hover:text-zinc-600"
                    )}
                  >
                    macOS Integration
                  </button>
                </div>

                <div className="p-6">
                  {activeTab === 'setup' ? (
                    <div className="space-y-6">
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
                        <div className="space-y-4 pt-4 border-t border-zinc-100">
                          <h3 className="text-sm font-bold">Pushover 스마트폰 알림 (선택)</h3>
                          <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">App Token</label>
                            <input 
                              name="pushoverAppToken"
                              placeholder="Pushover App Token"
                              defaultValue={settings?.pushoverAppToken || ""}
                              className="w-full rounded-lg border border-zinc-200 px-4 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">User Key</label>
                            <input 
                              name="pushoverUserKey"
                              placeholder="Pushover User Key"
                              defaultValue={settings?.pushoverUserKey || ""}
                              className="w-full rounded-lg border border-zinc-200 px-4 py-2 text-sm focus:border-zinc-400 focus:outline-none"
                            />
                          </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                          {settings && (
                            <>
                              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowSettings(false)}>
                                Cancel
                              </Button>
                              <Button type="button" variant="secondary" className="flex-1" onClick={handleTestPushover}>
                                랜덤 표정 테스트
                              </Button>
                            </>
                          )}
                          <Button type="submit" className="flex-1 border border-zinc-900">
                            Save & Connect
                          </Button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <h2 className="text-2xl font-bold tracking-tight">macOS Desktop Notifications</h2>
                        <p className="text-sm text-zinc-500">Use this Python script to get native macOS notifications on your desktop.</p>
                      </div>
                      <div className="relative">
                        <pre className="max-h-[300px] overflow-y-auto rounded-lg bg-zinc-900 p-4 text-[10px] text-zinc-300">
                          {macosScript}
                        </pre>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="absolute right-4 top-4"
                          onClick={() => {
                            navigator.clipboard.writeText(macosScript);
                            alert("Script copied to clipboard!");
                          }}
                        >
                          Copy Script
                        </Button>
                      </div>
                      <div className="rounded-lg bg-blue-50 p-4 text-xs text-blue-700">
                        <p className="font-bold">How to use:</p>
                        <ol className="ml-4 mt-2 list-decimal space-y-1">
                          <li>Install requests: <code className="bg-blue-100 px-1">pip install requests</code></li>
                          <li>Save the script as <code className="bg-blue-100 px-1">canvas_notify.py</code></li>
                          <li>Run it: <code className="bg-blue-100 px-1">python canvas_notify.py</code></li>
                        </ol>
                      </div>
                      <Button variant="outline" className="w-full" onClick={() => setShowSettings(false)}>
                        Close
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
