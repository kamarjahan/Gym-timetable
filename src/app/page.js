"use client";

import { useState, useEffect, useRef } from "react";
import { auth, googleProvider, db } from "../lib/firebase";
import { signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Check, Plus, Trash2, Edit2, LogOut, Flame, Calendar, Trophy, 
  User, X, History, RefreshCcw, Play, Timer, Zap 
} from "lucide-react";

// --- CONSTANTS ---
const DEFAULT_SCHEDULE = {
  Monday: [{ id: 1, name: "Push Ups", sets: "4x12" }],
  Tuesday: [{ id: 1, name: "Squats", sets: "4x15" }],
  Wednesday: [{ id: 1, name: "Pull Ups", sets: "3x8" }],
  Thursday: [{ id: 1, name: "Rest Day", sets: "-" }],
  Friday: [{ id: 1, name: "Dumbbell Press", sets: "4x10" }],
  Saturday: [{ id: 1, name: "Running", sets: "20 Mins" }],
  Sunday: [{ id: 1, name: "Yoga", sets: "30 Mins" }],
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function Home() {
  // Auth & Data State
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [history, setHistory] = useState([]); 
  const [records, setRecords] = useState([]); 
  const [userData, setUserData] = useState({});

  // UI State
  const [selectedDay, setSelectedDay] = useState("Monday");
  const [isEditing, setIsEditing] = useState(false);
  const [completedToday, setCompletedToday] = useState({});
  const [showProfile, setShowProfile] = useState(false);
  const [profileTab, setProfileTab] = useState("stats");

  // Timer & Workout State
  const [timer, setTimer] = useState(0);
  const [isWorkoutActive, setIsWorkoutActive] = useState(false); // Controls the session
  const intervalRef = useRef(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        setUser(currentUser);
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setSchedule(data.schedule || DEFAULT_SCHEDULE);
          setHistory(data.history || []);
          setRecords(data.records || []);
          setUserData(data);
        } else {
          const newUserData = {
            name: currentUser.displayName,
            email: currentUser.email,
            startedAt: new Date().toISOString(),
            schedule: DEFAULT_SCHEDULE,
            history: [],
            records: []
          };
          await setDoc(docRef, newUserData);
          setUserData(newUserData);
          setSchedule(DEFAULT_SCHEDULE);
        }
        
        const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        setSelectedDay(todayName);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- TIMER LOGIC ---
  useEffect(() => {
    if (isWorkoutActive) {
      intervalRef.current = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isWorkoutActive]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // --- ACTIONS ---
  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); } catch (e) { console.error(e); }
  };

  const startWorkout = () => {
    setTimer(0);
    setIsWorkoutActive(true);
    setCompletedToday({}); // Reset checks for the new session
  };

  const finishDay = async () => {
    if (!user) return;
    
    // 1. Stop the Timer
    setIsWorkoutActive(false); 
    
    const todayStr = new Date().toISOString().split('T')[0];
    const durationStr = formatTime(timer);
    
    // 2. Save Data to Firebase
    const newHistory = [...history, todayStr];
    const newRecord = { date: todayStr, duration: durationStr };
    const newRecords = [newRecord, ...records]; 

    setHistory(newHistory);
    setRecords(newRecords);

    await updateDoc(doc(db, "users", user.uid), {
      history: arrayUnion(todayStr),
      records: arrayUnion(newRecord)
    });
    
    // 3. RESET PROGRESS TO FRESH (Clear checkmarks immediately)
    setCompletedToday({}); 
    
    // 4. Reset Timer Visuals
    setTimer(0);

    alert(`Great job! Workout completed in ${durationStr}`);
  };

  // Schedule Management
  const saveSchedule = async (newSchedule) => {
    setSchedule(newSchedule);
    if (user) await updateDoc(doc(db, "users", user.uid), { schedule: newSchedule });
  };

  const addExercise = () => {
    const newWorkout = { id: Date.now(), name: "New Exercise", sets: "3x10" };
    const updatedDay = [...(schedule[selectedDay] || []), newWorkout];
    saveSchedule({ ...schedule, [selectedDay]: updatedDay });
  };

  const removeExercise = (id) => {
    const updatedDay = schedule[selectedDay].filter((w) => w.id !== id);
    saveSchedule({ ...schedule, [selectedDay]: updatedDay });
  };

  const updateExercise = (id, field, value) => {
    const updatedDay = schedule[selectedDay].map((w) => 
      w.id === id ? { ...w, [field]: value } : w
    );
    saveSchedule({ ...schedule, [selectedDay]: updatedDay });
  };

  const toggleExerciseComplete = (id) => {
    if (isEditing) return;
    // Only allow checking off if workout is active or we are just viewing
    if (!isWorkoutActive && !isEditing) {
      alert("Please press 'Start Workout' to begin tracking!");
      return;
    }
    setCompletedToday(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Reset Actions
  const resetStreak = async () => {
    if (confirm("Are you sure? This will wipe your streak history.")) {
      setHistory([]);
      setRecords([]);
      await updateDoc(doc(db, "users", user.uid), { history: [], records: [] });
    }
  };

  const resetCustomization = async () => {
    if (confirm("Reset all workouts to default template?")) {
      setSchedule(DEFAULT_SCHEDULE);
      await updateDoc(doc(db, "users", user.uid), { schedule: DEFAULT_SCHEDULE });
    }
  };

  const calculateStreak = () => history.length;
  const daysSinceStart = () => {
    if (!userData.startedAt) return 0;
    const diff = new Date() - new Date(userData.startedAt);
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-black text-white font-mono">LOADING...</div>;

  if (!user) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-black">
      <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600 mb-6">ProFit Tracker</h1>
      <button onClick={handleLogin} className="px-8 py-4 bg-white text-black font-bold rounded-full shadow-lg hover:scale-105 transition">Get Started</button>
    </div>
  );

  return (
    <div className="min-h-screen pb-32 max-w-md mx-auto md:max-w-2xl bg-black text-white relative overflow-hidden">
      
      {/* --- HEADER & TIMER --- */}
      <div className="pt-6 px-4 pb-4 bg-gradient-to-b from-blue-900/20 to-transparent">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
             <div onClick={() => setShowProfile(true)} className="cursor-pointer">
                {user.photoURL ? (
                  <img src={user.photoURL} className="w-10 h-10 rounded-full border-2 border-blue-500" alt="Profile" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-surface border-2 border-blue-500 flex items-center justify-center"><User size={20} /></div>
                )}
             </div>
             <div>
               <h2 className="text-xs text-gray-400 font-bold uppercase tracking-wider">Welcome</h2>
               <h1 className="font-bold text-lg leading-none">{user.displayName.split(' ')[0]}</h1>
             </div>
          </div>
          
          {/* TIMER DISPLAY */}
          <div className={`flex items-center gap-3 px-4 py-2 rounded-full backdrop-blur-md border transition-colors duration-500 ${isWorkoutActive ? "bg-green-500/20 border-green-500/50" : "bg-white/10 border-white/5"}`}>
            <Timer size={16} className={isWorkoutActive ? "text-green-400 animate-pulse" : "text-gray-400"} />
            <span className={`font-mono text-xl font-bold tracking-widest ${isWorkoutActive ? "text-white" : "text-gray-400"}`}>{formatTime(timer)}</span>
          </div>
        </div>

        {/* STATS ROW */}
        <div className="grid grid-cols-3 gap-3">
          <StatsCard icon={<Flame className="text-orange-500" />} label="Streak" value={calculateStreak()} />
          <StatsCard icon={<Calendar className="text-blue-500" />} label="Since" value={daysSinceStart()} />
          <StatsCard icon={<Trophy className="text-yellow-500" />} label="Total" value={history.length} />
        </div>
      </div>

      {/* --- DAY SELECTOR --- */}
      <div className="px-4 mb-2">
        <div className="flex overflow-x-auto gap-3 pb-4 scrollbar-hide">
          {DAYS.map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-5 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all duration-300 ${
                selectedDay === day 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30" 
                  : "bg-[#1e1e24] text-gray-400 hover:bg-[#272730]"
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      {/* --- WORKOUT AREA --- */}
      <div className="px-4 relative">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">{selectedDay}</h3>
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg transition ${
              isEditing ? "bg-green-500/20 text-green-400" : "bg-white/5 text-gray-400"
            }`}
          >
            <Edit2 size={12} /> {isEditing ? "SAVE" : "EDIT"}
          </button>
        </div>

        {/* Workout List */}
        <div className={`space-y-3 transition-all duration-500 ${!isWorkoutActive && !isEditing ? "opacity-50 grayscale blur-[1px]" : "opacity-100"}`}>
          <AnimatePresence mode="popLayout">
            {schedule[selectedDay]?.map((workout) => (
              <motion.div
                key={workout.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => toggleExerciseComplete(workout.id)}
                className={`relative p-4 rounded-2xl border transition-all duration-200 ${
                  completedToday[workout.id] && !isEditing
                    ? "bg-green-900/20 border-green-500/30"
                    : "bg-[#1e1e24] border-white/5"
                } ${!isEditing && isWorkoutActive && "active:scale-[0.98] cursor-pointer"}`}
              >
                <div className="flex justify-between items-center gap-4">
                  {isEditing ? (
                    <div className="flex-1 grid gap-2">
                      <input 
                        value={workout.name} 
                        onChange={(e) => updateExercise(workout.id, 'name', e.target.value)}
                        className="bg-black/50 p-2 rounded border border-white/10 text-white text-sm"
                        placeholder="Workout Name"
                      />
                      <input 
                        value={workout.sets} 
                        onChange={(e) => updateExercise(workout.id, 'sets', e.target.value)}
                        className="bg-black/50 p-2 rounded border border-white/10 text-white text-xs w-2/3"
                        placeholder="Sets"
                      />
                    </div>
                  ) : (
                    <div className="flex-1">
                      <h4 className={`font-bold text-lg ${completedToday[workout.id] ? "text-gray-500 line-through" : "text-white"}`}>
                        {workout.name}
                      </h4>
                      <p className="text-sm text-gray-400 font-mono">{workout.sets}</p>
                    </div>
                  )}

                  {isEditing ? (
                    <button onClick={() => removeExercise(workout.id)} className="p-3 bg-red-500/10 text-red-500 rounded-xl">
                      <Trash2 size={18} />
                    </button>
                  ) : (
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      completedToday[workout.id] ? "bg-green-500 border-green-500" : "border-gray-600"
                    }`}>
                      {completedToday[workout.id] && <Check size={14} className="text-black stroke-[3]" />}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isEditing && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={addExercise}
              className="w-full py-4 border-2 border-dashed border-gray-700 rounded-2xl text-gray-500 flex justify-center items-center gap-2 hover:bg-white/5 transition"
            >
              <Plus size={20} /> Add Exercise
            </motion.button>
          )}
        </div>
        
        {/* Overlay Message when inactive */}
        {!isWorkoutActive && !isEditing && (
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             {/* This space is intentionally left empty or could have a 'Press Start' label, 
                 but the button below is sufficient cue. */}
           </div>
        )}
      </div>

      {/* --- FOOTER CONTROL BAR --- */}
      {!isEditing && (
        <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black via-black/90 to-transparent flex justify-center z-30">
           {isWorkoutActive ? (
             <motion.button
               initial={{ y: 20, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               whileTap={{ scale: 0.95 }}
               onClick={finishDay}
               className="w-full max-w-md bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-green-900/30 flex justify-center items-center gap-2"
             >
               <Check size={24} /> Finish Today ({formatTime(timer)})
             </motion.button>
           ) : (
             <motion.button
               initial={{ y: 20, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               whileTap={{ scale: 0.95 }}
               onClick={startWorkout}
               className="w-full max-w-md bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-900/30 flex justify-center items-center gap-2"
             >
               <Play size={24} fill="white" /> START WORKOUT
             </motion.button>
           )}
        </div>
      )}

      {/* --- PROFILE MODAL --- */}
      <AnimatePresence>
        {showProfile && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowProfile(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-sm bg-[#18181b] z-50 shadow-2xl border-l border-white/10 flex flex-col"
            >
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#1e1e24]">
                <h2 className="text-xl font-bold">Profile</h2>
                <button onClick={() => setShowProfile(false)} className="p-2 bg-white/10 rounded-full"><X size={18} /></button>
              </div>

              <div className="flex p-4 gap-2">
                <TabButton active={profileTab === "stats"} onClick={() => setProfileTab("stats")} icon={<History size={16}/>} label="Records" />
                <TabButton active={profileTab === "settings"} onClick={() => setProfileTab("settings")} icon={<RefreshCcw size={16}/>} label="Settings" />
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {profileTab === "stats" ? (
                  <div className="space-y-2">
                    <h3 className="text-sm text-gray-500 font-bold uppercase mb-2">Completion History</h3>
                    {records.length === 0 ? (
                      <div className="text-center text-gray-600 py-10">No records yet. Start working out!</div>
                    ) : (
                      records.map((rec, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                          <span className="text-sm text-gray-300">{rec.date}</span>
                          <span className="font-mono text-green-400 font-bold flex items-center gap-2">
                            <Zap size={12}/> {rec.duration}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-red-400 font-bold mb-2 uppercase text-xs">Danger Zone</h3>
                      <div className="space-y-2">
                        <button onClick={resetStreak} className="w-full p-3 bg-red-900/20 text-red-500 rounded-xl flex items-center gap-3 hover:bg-red-900/30">
                          <Flame size={18} /> Reset Streak & History
                        </button>
                        <button onClick={resetCustomization} className="w-full p-3 bg-red-900/20 text-red-500 rounded-xl flex items-center gap-3 hover:bg-red-900/30">
                          <RefreshCcw size={18} /> Reset Schedule to Default
                        </button>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-gray-400 font-bold mb-2 uppercase text-xs">Account</h3>
                      <button onClick={() => signOut(auth)} className="w-full p-3 bg-white/10 text-white rounded-xl flex items-center gap-3 hover:bg-white/20">
                        <LogOut size={18} /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- SUBCOMPONENTS ---
function StatsCard({ icon, label, value }) {
  return (
    <div className="bg-[#1e1e24] p-3 rounded-2xl flex flex-col items-center justify-center text-center border border-white/5 shadow-lg">
      <div className="mb-1 transform scale-90">{icon}</div>
      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">{label}</span>
      <span className="text-lg font-bold text-white leading-tight">{value}</span>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button 
      onClick={onClick}
      className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition ${
        active ? "bg-blue-600 text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
      }`}
    >
      {icon} {label}
    </button>
  );
}