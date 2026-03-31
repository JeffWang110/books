import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import {
  Check,
  Users,
  BookOpen,
  Calendar,
  Download,
  Flame,
  MessageCircle,
  UserPlus,
  LogIn
} from 'lucide-react';

// --- Firebase Configuration & Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyCHpym8hch-ItTEMhRdeAMkvb2qClEldiA",
  authDomain: "party-today-18738.firebaseapp.com",
  projectId: "party-today-18738",
  storageBucket: "party-today-18738.firebasestorage.app",
  messagingSenderId: "561672972974",
  appId: "1:561672972974:web:ce616b5fb91cbd46591b3f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'books-app';

// --- Constants & Data ---
const generateDateRange = () => {
  const dates = [];
  const start = new Date(2026, 1, 1);
  const end = new Date(2026, 5, 30);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(new Date(d));
  }
  return dates;
};

const ALL_DATES = generateDateRange();

const formatDate = (date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const getDayName = (date) => {
  const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  return days[date.getDay()];
};

// --- Decorative Components ---
const BookPattern = () => (
  <div className="absolute inset-0 z-0 opacity-10 pointer-events-none overflow-hidden">
    <div className="absolute inset-0" style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
    }}></div>
  </div>
);

// --- Main Component ---
export default function App() {
  const [user, setUser] = useState(null);
  const [selectedName, setSelectedName] = useState("");
  const [inputName, setInputName] = useState("");
  const [rsvpData, setRsvpData] = useState({});
  const [myDates, setMyDates] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('login');

  // 從 localStorage 讀取已儲存的名稱
  useEffect(() => {
    const savedName = localStorage.getItem('books_user_name');
    if (savedName) {
      setInputName(savedName);
    }
  }, []);

  // Auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth failed", error);
        alert("登入失敗，請檢查網路連線後重新整理頁面");
        setLoading(false);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        setLoading(false);
      }
    });

    const timeout = setTimeout(() => {
      if (!user) {
        console.error("Auth timeout - user still null after 10 seconds");
      }
      setLoading(false);
    }, 10000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // Data Sync
  useEffect(() => {
    if (!user) return;
    const rsvpRef = collection(db, 'artifacts', appId, 'public', 'data', 'books_rsvp');
    const unsubscribe = onSnapshot(rsvpRef,
      (snapshot) => {
        const data = {};
        snapshot.docs.forEach(doc => {
          data[doc.id] = doc.data();
        });
        setRsvpData(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching data:", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (selectedName && rsvpData[selectedName]?.dates) {
      setMyDates(new Set(rsvpData[selectedName].dates));
    }
  }, [selectedName, rsvpData]);

  const handleLogin = () => {
    const trimmedName = inputName.trim();
    if (!trimmedName) {
      alert("請輸入您的名稱");
      return;
    }
    if (trimmedName.length > 20) {
      alert("名稱請勿超過 20 個字");
      return;
    }
    // 儲存名稱到 localStorage
    localStorage.setItem('books_user_name', trimmedName);
    setSelectedName(trimmedName);
    setView('calendar');
  };

  const handleSelectExistingUser = (name) => {
    setInputName(name);
    localStorage.setItem('books_user_name', name);
    setSelectedName(name);
    setView('calendar');
  };

  const toggleDate = (dateStr) => {
    const newDates = new Set(myDates);
    if (newDates.has(dateStr)) {
      newDates.delete(dateStr);
    } else {
      newDates.add(dateStr);
    }
    setMyDates(newDates);
  };

  const saveAvailability = async () => {
    if (!user) {
      alert("尚未登入，請重新整理頁面後再試");
      console.error("Save failed: user is null");
      return;
    }
    if (!selectedName) {
      alert("請先輸入您的名稱");
      return;
    }
    if (myDates.size === 0) {
      alert("請至少選擇一個日期");
      return;
    }
    const userDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'books_rsvp', selectedName);
    try {
      await setDoc(userDocRef, {
        name: selectedName,
        dates: Array.from(myDates),
        updatedAt: serverTimestamp(),
        uid: user.uid
      }, { merge: true });
      alert(`${selectedName} 的時間已儲存！`);
    } catch (e) {
      console.error("Save failed", e);
      alert("儲存失敗：" + e.message);
    }
  };

  const stats = useMemo(() => {
    const dateCounts = {};
    const dateAttendees = {};
    ALL_DATES.forEach(d => {
      const dStr = formatDate(d);
      dateCounts[dStr] = 0;
      dateAttendees[dStr] = [];
    });
    Object.values(rsvpData).forEach(person => {
      if (person.dates && Array.isArray(person.dates)) {
        person.dates.forEach(dStr => {
          if (dateCounts[dStr] !== undefined) {
            dateCounts[dStr]++;
            dateAttendees[dStr].push(person.name);
          }
        });
      }
    });
    const sortedDates = Object.entries(dateCounts)
      .sort((a, b) => b[1] - a[1])
      .filter(([_, count]) => count > 0);
    return { dateCounts, dateAttendees, sortedDates };
  }, [rsvpData]);

  const downloadCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "日期,星期,人數,名單\n";
    stats.sortedDates.forEach(([dateStr, count]) => {
      const dateObj = new Date(dateStr);
      const dayName = getDayName(dateObj);
      const names = stats.dateAttendees[dateStr].join(", ");
      csvContent += `${dateStr},${dayName},${count},"${names}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "讀書會_統計表.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 取得已登記的使用者列表
  const existingUsers = Object.keys(rsvpData).sort();

  // --- Views ---
  const renderLoginView = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 relative z-10">
      {/* 主要登入區塊 */}
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border-t-4 border-emerald-500 relative z-10 mb-6">
        <div className="flex items-center justify-center gap-3 mb-6">
          <BookOpen size={32} className="text-emerald-600" />
          <h2 className="text-2xl font-bold text-gray-800">輸入您的名稱</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              請輸入您的名稱（或暱稱）
            </label>
            <input
              type="text"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="例如：小明"
              maxLength={20}
              autoFocus
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-lg focus:border-emerald-500 focus:outline-none transition-colors"
            />
          </div>

          <button
            onClick={handleLogin}
            className="w-full bg-emerald-600 text-white py-3 rounded-lg text-lg font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-lg"
          >
            <UserPlus size={20} />
            開始登記時間
          </button>
        </div>

        <p className="mt-4 text-xs text-center text-gray-400">
          首次使用請直接輸入名稱，系統會自動記住您
        </p>
      </div>

      {/* 已登記的使用者列表 */}
      {existingUsers.length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-lg max-w-md w-full border border-gray-200">
          <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
            <LogIn size={20} className="text-emerald-600" />
            已登記的成員（點擊可快速登入）
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {existingUsers.map(name => (
              <button
                key={name}
                onClick={() => handleSelectExistingUser(name)}
                className="p-2 rounded-lg text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1"
              >
                {name}
                <Check size={14} className="text-green-500" />
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-center text-gray-400">
            共 {existingUsers.length} 人已填寫
          </p>
        </div>
      )}
    </div>
  );

  const renderCalendarView = () => (
    <div className="max-w-4xl mx-auto pb-20 relative z-10">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden border-2 border-gray-200">
        <div className="bg-emerald-600 p-4 text-white flex justify-between items-center sticky top-0 z-10">
          <div>
            <span className="text-xs opacity-80 block">目前身分</span>
            <span className="font-bold text-xl">{selectedName}</span>
          </div>
          <div className="flex gap-2">
             <button
              onClick={() => setView('stats')}
              className="bg-black/20 hover:bg-black/30 px-3 py-1.5 rounded text-sm flex items-center gap-1"
            >
              <Users size={16} /> 查看統計
            </button>
            <button
              type="button"
              onClick={saveAvailability}
              className="bg-yellow-400 text-black hover:bg-yellow-300 font-bold px-4 py-1.5 rounded text-sm shadow-md"
            >
              儲存我的時間
            </button>
          </div>
        </div>

        <div className="p-4">
          <p className="mb-4 text-gray-700 text-sm bg-emerald-50 p-3 rounded border border-emerald-200 flex items-center gap-2">
            <MessageCircle size={20} className="text-emerald-600"/>
            <span>請點選您可以參加讀書會的日期（綠色代表已選取）。記得按下右上角的「儲存」！</span>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* 2月 */}
            <div>
              <h3 className="text-center font-bold text-xl text-gray-800 mb-3 bg-gray-100 py-2 rounded">2月 February</h3>
              <div className="grid grid-cols-7 gap-1 text-center mb-1 font-bold">
                {['日','一','二','三','四','五','六'].map(d => (
                  <div key={d} className="text-xs text-gray-500">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({length: new Date(2026, 1, 1).getDay()}, (_, i) => <div key={`e1-${i}`} />)}
                {ALL_DATES.filter(d => d.getMonth() === 1).map(date => {
                  const dStr = formatDate(date);
                  const isSelected = myDates.has(dStr);
                  const dayName = getDayName(date);
                  const isWeekend = dayName === '週六' || dayName === '週日';

                  return (
                    <button
                      key={dStr}
                      onClick={() => toggleDate(dStr)}
                      className={`
                        aspect-square rounded flex flex-col items-center justify-center text-sm relative transition-all
                        ${isSelected
                          ? 'bg-green-500 text-white shadow-sm transform scale-105'
                          : isWeekend ? 'bg-emerald-50 text-gray-800 hover:bg-emerald-100' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }
                      `}
                    >
                      <span className="font-bold">{date.getDate()}</span>
                      {stats.dateCounts[dStr] > 0 && !isSelected && (
                        <span className="absolute bottom-1 right-1 text-[10px] bg-white border border-gray-300 text-gray-800 rounded-full w-4 h-4 flex items-center justify-center font-bold">
                          {stats.dateCounts[dStr]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3月 */}
            <div>
              <h3 className="text-center font-bold text-xl text-gray-800 mb-3 bg-gray-100 py-2 rounded">3月 March</h3>
              <div className="grid grid-cols-7 gap-1 text-center mb-1 font-bold">
                {['日','一','二','三','四','五','六'].map(d => (
                  <div key={d} className="text-xs text-gray-500">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({length: new Date(2026, 2, 1).getDay()}, (_, i) => <div key={`e2-${i}`} />)}
                {ALL_DATES.filter(d => d.getMonth() === 2).map(date => {
                  const dStr = formatDate(date);
                  const isSelected = myDates.has(dStr);
                  const dayName = getDayName(date);
                  const isWeekend = dayName === '週六' || dayName === '週日';

                  return (
                    <button
                      key={dStr}
                      onClick={() => toggleDate(dStr)}
                      className={`
                        aspect-square rounded flex flex-col items-center justify-center text-sm relative transition-all
                        ${isSelected
                          ? 'bg-green-500 text-white shadow-sm transform scale-105'
                          : isWeekend ? 'bg-emerald-50 text-gray-800 hover:bg-emerald-100' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }
                      `}
                    >
                      <span className="font-bold">{date.getDate()}</span>
                      {stats.dateCounts[dStr] > 0 && !isSelected && (
                        <span className="absolute bottom-1 right-1 text-[10px] bg-white border border-gray-300 text-gray-800 rounded-full w-4 h-4 flex items-center justify-center font-bold">
                          {stats.dateCounts[dStr]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4月 */}
            <div>
              <h3 className="text-center font-bold text-xl text-gray-800 mb-3 bg-gray-100 py-2 rounded">4月 April</h3>
              <div className="grid grid-cols-7 gap-1 text-center mb-1 font-bold">
                {['日','一','二','三','四','五','六'].map(d => (
                  <div key={d} className="text-xs text-gray-500">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({length: new Date(2026, 3, 1).getDay()}, (_, i) => <div key={`e3-${i}`} />)}
                {ALL_DATES.filter(d => d.getMonth() === 3).map(date => {
                  const dStr = formatDate(date);
                  const isSelected = myDates.has(dStr);
                  const dayName = getDayName(date);
                  const isWeekend = dayName === '週六' || dayName === '週日';

                  return (
                    <button
                      key={dStr}
                      onClick={() => toggleDate(dStr)}
                      className={`
                        aspect-square rounded flex flex-col items-center justify-center text-sm relative transition-all
                        ${isSelected
                          ? 'bg-green-500 text-white shadow-sm transform scale-105'
                          : isWeekend ? 'bg-emerald-50 text-gray-800 hover:bg-emerald-100' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }
                      `}
                    >
                      <span className="font-bold">{date.getDate()}</span>
                      {stats.dateCounts[dStr] > 0 && !isSelected && (
                        <span className="absolute bottom-1 right-1 text-[10px] bg-white border border-gray-300 text-gray-800 rounded-full w-4 h-4 flex items-center justify-center font-bold">
                          {stats.dateCounts[dStr]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5月 */}
            <div>
              <h3 className="text-center font-bold text-xl text-gray-800 mb-3 bg-gray-100 py-2 rounded">5月 May</h3>
              <div className="grid grid-cols-7 gap-1 text-center mb-1 font-bold">
                {['日','一','二','三','四','五','六'].map(d => (
                  <div key={d} className="text-xs text-gray-500">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({length: new Date(2026, 4, 1).getDay()}, (_, i) => <div key={`e4-${i}`} />)}
                {ALL_DATES.filter(d => d.getMonth() === 4).map(date => {
                  const dStr = formatDate(date);
                  const isSelected = myDates.has(dStr);
                  const dayName = getDayName(date);
                  const isWeekend = dayName === '週六' || dayName === '週日';

                  return (
                    <button
                      key={dStr}
                      onClick={() => toggleDate(dStr)}
                      className={`
                        aspect-square rounded flex flex-col items-center justify-center text-sm relative transition-all
                        ${isSelected
                          ? 'bg-green-500 text-white shadow-sm transform scale-105'
                          : isWeekend ? 'bg-emerald-50 text-gray-800 hover:bg-emerald-100' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }
                      `}
                    >
                      <span className="font-bold">{date.getDate()}</span>
                      {stats.dateCounts[dStr] > 0 && !isSelected && (
                        <span className="absolute bottom-1 right-1 text-[10px] bg-white border border-gray-300 text-gray-800 rounded-full w-4 h-4 flex items-center justify-center font-bold">
                          {stats.dateCounts[dStr]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 6月 */}
            <div>
              <h3 className="text-center font-bold text-xl text-gray-800 mb-3 bg-gray-100 py-2 rounded">6月 June</h3>
              <div className="grid grid-cols-7 gap-1 text-center mb-1 font-bold">
                {['日','一','二','三','四','五','六'].map(d => (
                  <div key={d} className="text-xs text-gray-500">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({length: new Date(2026, 5, 1).getDay()}, (_, i) => <div key={`e5-${i}`} />)}
                {ALL_DATES.filter(d => d.getMonth() === 5).map(date => {
                  const dStr = formatDate(date);
                  const isSelected = myDates.has(dStr);
                  const dayName = getDayName(date);
                  const isWeekend = dayName === '週六' || dayName === '週日';

                  return (
                    <button
                      key={dStr}
                      onClick={() => toggleDate(dStr)}
                      className={`
                        aspect-square rounded flex flex-col items-center justify-center text-sm relative transition-all
                        ${isSelected
                          ? 'bg-green-500 text-white shadow-sm transform scale-105'
                          : isWeekend ? 'bg-emerald-50 text-gray-800 hover:bg-emerald-100' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }
                      `}
                    >
                      <span className="font-bold">{date.getDate()}</span>
                      {stats.dateCounts[dStr] > 0 && !isSelected && (
                        <span className="absolute bottom-1 right-1 text-[10px] bg-white border border-gray-300 text-gray-800 rounded-full w-4 h-4 flex items-center justify-center font-bold">
                          {stats.dateCounts[dStr]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStatsView = () => (
    <div className="max-w-2xl mx-auto relative z-10">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Flame className="text-orange-500" />
            人氣日期排行榜
          </h2>
          <button
            onClick={() => setView('calendar')}
            className="text-gray-500 hover:text-gray-800 font-bold underline"
          >
            返回填寫
          </button>
        </div>

        {stats.sortedDates.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            還沒有人填寫時間！
          </div>
        ) : (
          <div className="space-y-4">
            {stats.sortedDates.slice(0, 10).map(([dateStr, count], index) => {
              const dateObj = new Date(dateStr);
              return (
                <div key={dateStr} className="flex items-center p-3 rounded-lg border border-gray-200 bg-white shadow-sm">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-bold text-white mr-4
                    ${index === 0 ? 'bg-yellow-400 text-black' :
                      index === 1 ? 'bg-gray-400' :
                      index === 2 ? 'bg-orange-600' : 'bg-emerald-100 text-emerald-600'}
                  `}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-lg">
                      {dateObj.getMonth() + 1}/{dateObj.getDate()}
                      <span className="text-sm font-normal text-gray-500 ml-2">({getDayName(dateObj)})</span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {stats.dateAttendees[dateStr].join('、')}
                    </div>
                  </div>
                  <div className="text-right pl-4">
                    <span className="block text-2xl font-bold text-green-600">{count}</span>
                    <span className="text-xs text-gray-400">人有空</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 pt-4 border-t flex justify-center">
           <button
             onClick={downloadCSV}
             className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-colors shadow-lg"
           >
             <Download size={18} />
             匯出 Excel/CSV
           </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 font-sans text-gray-800 overflow-x-hidden">
      <BookPattern />
      <header className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 shadow-md relative z-10">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <BookOpen size={36} />
            讀書會天地
          </h1>
          <div className="flex flex-wrap gap-2 text-sm opacity-90">
            <span className="bg-white/20 px-3 py-1 rounded flex items-center gap-1">
              <Calendar size={14} /> 時間登記表
            </span>
            <span className="bg-white/20 px-3 py-1 rounded">
              2026年2月～6月
            </span>
          </div>
        </div>
      </header>

      <main className="p-4 relative">
        {loading ? (
          <div className="text-center py-20 relative z-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-emerald-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 font-medium">載入中...</p>
          </div>
        ) : (
          <>
            {view === 'login' && renderLoginView()}
            {view === 'calendar' && renderCalendarView()}
            {view === 'stats' && renderStatsView()}
          </>
        )}
      </main>

      <footer className="text-center text-gray-400 text-xs py-8 relative z-10">
        2026.2.1 ～ 2026.6.30 讀書會時間登記 <br/>
        讀書會天地
      </footer>
    </div>
  );
}
