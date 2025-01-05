import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { invoke } from "@tauri-apps/api/core";

interface BusstopPole {
    title: {
        en: string | null,
        ja: string,
        ja_hrkt: string | null
    } | null;
    busstop_pole_id: string;
    latitude: number;
    longitude: number;
    busroute_pattern: string[];
    busstop_pole_timetable: string[];
}

interface BusroutePattern {
    busroute_pattern_id: string;
    route_name: string;
    from_busstop_pole: string;
    to_busstop_pole: string;
}


function App() {
    const [busStops, setBusStops] = useState<BusstopPole[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [inputValue, setInputValue] = useState('');
    const [filteredBusStops, setFilteredBusStops] = useState<BusstopPole[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
     const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
    const [selectedBusStop, setSelectedBusStop] = useState<BusstopPole | null>(null);
    const [busRoutes, setBusRoutes] = useState<BusroutePattern[]>([]);
     const [selectedDestination, setSelectedDestination] = useState<string | null>(null);


    useEffect(() => {
        const fetchBusStops = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const result = await invoke<BusstopPole[]>('get_bus_stops');
                 console.log("取得したバス停データ:", result);
                 const uniqueBusStops = removeDuplicateBusStops(result);
                  setBusStops(uniqueBusStops);
            } catch (e: any) {
                setError(e.toString());
            } finally {
                setIsLoading(false);
            }
        };
        fetchBusStops();
    }, []);


    useEffect(() => {
        if (inputValue) {
             const filtered = busStops.filter((busStop) =>
                busStop.title && busStop.title.ja.includes(inputValue)
            );
            setFilteredBusStops(filtered);
            setShowSuggestions(filtered.length > 0);
              setSelectedSuggestionIndex(-1);
        } else {
            setFilteredBusStops([]);
            setShowSuggestions(false);
              setSelectedSuggestionIndex(-1);
        }
    }, [inputValue, busStops]);


    useEffect(() => {
         const fetchBusRoutes = async () => {
             if (selectedBusStop) {
                setIsLoading(true);
                  setError(null);
               try{
                   const result = await invoke<BusroutePattern[]>('get_bus_routes');
                      console.log("取得した路線データ:", result);
                   const filteredRoutes = result.filter((route) =>
                       selectedBusStop.busroute_pattern.includes(route.busroute_pattern_id)
                   );
                       setBusRoutes(filteredRoutes);
               } catch(e:any){
                   setError(e.toString())
               } finally{
                   setIsLoading(false)
               }

            } else{
                 setBusRoutes([]);
             }
        };
          fetchBusRoutes()

    }, [selectedBusStop])


    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(event.target.value);
    };

   const handleSuggestionClick = (busStop: BusstopPole) => {
    setInputValue(busStop.title?.ja || "");
    setFilteredBusStops([]);
      setShowSuggestions(false);
        setSelectedBusStop(busStop);
        setSelectedDestination(null)
        setSelectedSuggestionIndex(-1);
    };
    const handleDestinationClick = (destination: string) => {
          setSelectedDestination(destination);
    };


  const handleInputBlur = () => {
    // フォーカスが外れたときに候補を非表示にする
    setTimeout(() => {
        setShowSuggestions(false);
    }, 100);
  };


     const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (showSuggestions && filteredBusStops.length > 0) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setSelectedSuggestionIndex((prevIndex) =>
                    Math.min(prevIndex + 1, filteredBusStops.length - 1)
                );
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setSelectedSuggestionIndex((prevIndex) => Math.max(prevIndex - 1, 0));
            }
              else if (event.key === 'Enter' && selectedSuggestionIndex !== -1) {
                  event.preventDefault();
                handleSuggestionClick(filteredBusStops[selectedSuggestionIndex]);
            }
        }
    };

    const removeDuplicateBusStops = (busStops: BusstopPole[]): BusstopPole[] => {
          const seen = new Set<string>();
         return busStops.filter((busStop) => {
            if(!busStop.title){
                return true;
            }
            const key = busStop.title.ja;
             if (seen.has(key)) {
                return false; // 重複はスキップ
            }
            seen.add(key);
            return true; // 初めての要素は残す
        });
    };

     if (isLoading) {
        return <div>Loading...</div>;
    }
   if (error) {
        return <div>Error: {error}</div>;
    }

    return (
        <div className="App">
            <h1>都営バス停</h1>
            <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                onKeyDown={handleKeyDown}
                ref={inputRef}
                placeholder="バス停名を入力"
                style={{ border: '1px solid #ccc', padding: '8px' }}
            />
            {showSuggestions && (
                <ul
                    style={{
                        border: '1px solid #ccc',
                        padding: '0',
                        listStyle: 'none',
                        marginTop: '0px',
                         backgroundColor: 'white',
                         position: 'absolute',
                         zIndex: 1,
                        width: 200,
                    }}
                >
                    {filteredBusStops.map((busStop, index) => (
                        <li
                            key={busStop.busstop_pole_id}
                            onClick={() => handleSuggestionClick(busStop)}
                            style={{
                                padding: '8px',
                                cursor: 'pointer',
                                borderBottom: '1px solid #eee',
                                backgroundColor:
                                    index === selectedSuggestionIndex ? '#f0f0f0' : 'white',
                            }}
                             onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                            onMouseOut={(e) =>  e.currentTarget.style.backgroundColor = index === selectedSuggestionIndex ? '#f0f0f0' : 'white'}
                        >
                            {busStop.title ? (busStop.title.ja ? busStop.title.ja : "名称不明") : "名称不明"}
                        </li>
                    ))}
                </ul>
            )}
            {selectedBusStop && (
                <div style={{ marginTop: '10px' }}>
                   選択されたバス停: <span style={{ fontWeight: 'bold' }}>
                        {selectedBusStop.title ? (selectedBusStop.title.ja ? selectedBusStop.title.ja : "名称不明") : "名称不明"}
                    </span> ({selectedBusStop.busstop_pole_id})
                    <h4 style={{ marginTop: '10px' }}>行先を選択</h4>
                    {busRoutes.length > 0 ? (
                        <ul  style={{
                            border: '1px solid #ccc',
                            padding: '0',
                            listStyle: 'none',
                            marginTop: '0px',
                             backgroundColor: 'white',
                            width: 200,
                        }}>
                            {busRoutes.map((route) => (
                                 <li
                                    key={route.busroute_pattern_id}
                                    onClick={() => handleDestinationClick(route.to_busstop_pole)}
                                    style={{
                                        padding: '8px',
                                        cursor: 'pointer',
                                        borderBottom: '1px solid #eee'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                >
                                     {route.to_busstop_pole}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div>該当する行先はありません</div>
                    )}

                </div>
            )}
              {selectedDestination && (
                <div style={{ marginTop: '10px' }}>
                  選択された行先: <span style={{ fontWeight: 'bold' }}>{selectedDestination}</span>
                </div>
            )}
        </div>
    );
}

export default App;