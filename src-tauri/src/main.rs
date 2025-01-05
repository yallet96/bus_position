#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize, Deserializer};
use tauri::command;
use reqwest::Client;
use tokio;
use std::fmt::Debug;

fn deserialize_title<'de, D>(deserializer: D) -> Result<Option<Title>, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum TitleOrString {
        Title(Title),
        String(String),
    }

    match TitleOrString::deserialize(deserializer)? {
        TitleOrString::Title(title) => Ok(Some(title)),
        TitleOrString::String(ja) => Ok(Some(Title {
            en: None,
            ja,
            ja_hrkt: None,
        })),
    }
}

// タイトル
#[derive(Serialize, Deserialize, Debug)]
struct Title {
    en: Option<String>,
    ja: String,
    #[serde(rename = "ja-Hrkt")]
    ja_hrkt: Option<String>,
}

// バス停情報
#[derive(Serialize, Deserialize, Debug)]
struct BusstopPole {
    #[serde(rename = "title", deserialize_with = "deserialize_title")]
    title: Option<Title>,
    #[serde(rename = "owl:sameAs")]
    same_as: String,
    #[serde(skip)]
    busstop_pole_id: String,
    #[serde(rename = "geo:lat")]
    latitude: f64,
    #[serde(rename = "geo:long")]
    longitude: f64,
    #[serde(rename = "odpt:busroutePattern")]
    busroute_pattern: Vec<String>,
    #[serde(rename = "odpt:busstopPoleTimetable")]
    busstop_pole_timetable: Vec<String>,
}

// バス路線情報
#[derive(Serialize, Deserialize, Debug)]
struct BusroutePattern {
    #[serde(skip)]
    // #[serde(rename = "odpt:busroutePatternId")]
    busroute_pattern_id: String,
    #[serde(rename = "odpt:routeName")]
    route_name: String,
    #[serde(rename = "odpt:fromBusstopPole")]
    from_busstop_pole: String,
    #[serde(rename = "odpt:toBusstopPole")]
    to_busstop_pole: String,
    // 必要に応じて他のフィールドも追加
}

// バス時刻表情報
#[derive(Serialize, Deserialize, Debug)]
struct BusstopPoleTimetable {
    #[serde(rename = "odpt:busstopPole")]
    busstop_pole: String,
    #[serde(rename = "odpt:timeTable")]
    time_table: Vec<TimeTableEntry>,
    // 必要に応じて他のフィールドも追加
}

#[derive(Serialize, Deserialize, Debug)]
struct TimeTableEntry {
    #[serde(rename = "odpt:departureTime")]
    departure_time: String,
    // 必要に応じて他のフィールドを追加
}

// バス位置情報
#[derive(Serialize, Deserialize, Debug)]
struct VehiclePosition {
    id: String,
    #[serde(rename = "gtfs:trip")]
    trip: TripInfo,
    #[serde(rename = "gtfs:vehicle")]
    vehicle: VehicleInfo,
    position: PositionInfo,
    // 必要に応じて他のフィールドも追加
}

#[derive(Serialize, Deserialize, Debug)]
struct TripInfo {
    #[serde(rename = "gtfs:tripId")]
    trip_id: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct VehicleInfo {
    #[serde(rename = "gtfs:id")]
    id: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct PositionInfo {
    latitude: f64,
    longitude: f64,
}
#[derive(Serialize, Deserialize, Debug)]
struct VehiclePositionResponse {
    entity: Vec<VehiclePosition>
}

#[command]
async fn get_bus_stops() -> Result<Vec<BusstopPole>, String> {
    let mut bus_stops = fetch_data::<Vec<BusstopPole>>("https://api-public.odpt.org/api/v4/odpt:BusstopPole.json").await?;
    for bus_stop in &mut bus_stops {
        if let Some(suffix) = bus_stop.same_as.split(".").last(){
            bus_stop.busstop_pole_id = suffix.to_string();
        }
    }
    Ok(bus_stops)
}

#[command]
async fn get_bus_routes() -> Result<Vec<BusroutePattern>, String> {
    fetch_data::<Vec<BusroutePattern>>("https://api-public.odpt.org/api/v4/odpt:BusroutePattern.json").await
}

#[command]
async fn get_bus_timetables() -> Result<Vec<BusstopPoleTimetable>, String> {
    fetch_data::<Vec<BusstopPoleTimetable>>("https://api-public.odpt.org/api/v4/odpt:BusstopPoleTimetable.json").await
}

#[command]
async fn get_bus_realtime() -> Result<Vec<VehiclePosition>, String> {
    let url = "https://api-public.odpt.org/api/v4/gtfs/realtime/ToeiBus";
    let client = Client::new();
    match client.get(url).send().await {
        Ok(response) => {
            println!("API response status: {:?}", response.status());
            if response.status().is_success() {
                match response.json::<VehiclePositionResponse>().await {
                    Ok(data) => {
                        println!("API data received: {:?}", data);
                        Ok(data.entity)
                    },
                    Err(err) => {
                        eprintln!("JSON 解析エラー: {:?}", err);
                        Err("JSON 解析エラー".into())
                    }
                }
            } else {
                eprintln!("API エラー: {:?}", response.status());
                Err(format!("API エラー: {}", response.status()))
            }
        }
        Err(err) => {
            eprintln!("リクエストエラー: {:?}", err);
            Err("リクエストエラー".into())
        }
    }
}

// 汎用的なデータフェッチ関数
async fn fetch_data<T: serde::de::DeserializeOwned + Debug>(url: &str) -> Result<T, String> {
    println!("fetch_data called for url: {}", url);
    let client = Client::new();
    match client.get(url).send().await {
        Ok(response) => {
            println!("API response status: {:?}", response.status());
            if response.status().is_success() {
                match response.json::<T>().await {
                    Ok(data) => {
                        // println!("API data received: {:?}", data);
                        Ok(data)
                    },
                    Err(err) => {
                        eprintln!("JSON 解析エラー: {:?}", err);
                        Err("JSON 解析エラー".into())
                    }
                }
            } else {
                eprintln!("API エラー: {:?}", response.status());
                Err(format!("API エラー: {}", response.status()))
            }
        }
        Err(err) => {
            eprintln!("リクエストエラー: {:?}", err);
            Err("リクエストエラー".into())
        }
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_bus_stops,
            get_bus_routes,
            get_bus_timetables,
            get_bus_realtime
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}