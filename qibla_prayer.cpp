#include <bits/stdc++.h>
using namespace std;
// Compile: g++ -O2 qibla_prayer.cpp -o qibla_prayer -lm
// Run: ./qibla_prayer  -lat <latitude> -lon <longitude>
// Example: ./qibla_prayer -lat -6.2 -lon 106.8

double toRad(double d){ return d * M_PI / 180.0; }
double toDeg(double r){ return r * 180.0 / M_PI; }
double fixAngle(double a){
    a = fmod(a,360.0);
    if(a < 0) a += 360.0;
    return a;
}

// Julian day from Unix time (ms -> days)
double toJulianDay(time_t t){
    return (double)t / 86400.0 + 2440587.5;
}

// simplified sun position (declination & eqtime approx)
void sunPosition(double jd, double &decl, double &eqt){
    double D = jd - 2451545.0;
    double g = fixAngle(357.529 + 0.98560028 * D);
    double q = fixAngle(280.459 + 0.98564736 * D);
    double L = fixAngle(q + 1.915 * sin(toRad(g)) + 0.020 * sin(toRad(2*g)));
    double e = 23.439 - 0.00000036 * D;
    double RA = atan2(cos(toRad(e))*sin(toRad(L)), cos(toRad(L)));
    RA = toDeg(RA)/15.0;
    decl = toDeg(asin(sin(toRad(e))*sin(toRad(L))));
    eqt = (q/15.0 - RA) * 15.0; // in minutes (approx)
}

// hour angle (degrees) for given zenith
double hourAngle(double lat, double decl, double zenith){
    double latR = toRad(lat), declR = toRad(decl), angR = toRad(zenith);
    double val = (sin(angR) - sin(latR)*sin(declR)) / (cos(latR)*cos(declR));
    if(val > 1) val = 1;
    if(val < -1) val = -1;
    double HA = acos(val);
    return toDeg(HA);
}

// compute qibla bearing
double computeQibla(double lat1, double lon1){
    double lat2 = 21.4225, lon2 = 39.8262;
    double φ1 = toRad(lat1), φ2 = toRad(lat2);
    double Δλ = toRad(lon2 - lon1);
    double x = sin(Δλ);
    double y = cos(φ1)*tan(φ2) - sin(φ1)*cos(Δλ);
    double brng = atan2(x,y);
    brng = toDeg(brng);
    brng = fmod(brng + 360.0, 360.0);
    return brng;
}

string hhmm(double hours){
    int h = (int)floor(hours);
    int m = (int)round((hours - h) * 60.0);
    if(m>=60){ h +=1; m -=60; }
    char buf[16];
    sprintf(buf, "%02d:%02d", (h+24)%24, m);
    return string(buf);
}

int main(int argc, char** argv){
    double lat=0.0, lon=0.0;
    for(int i=1;i<argc;i++){
        string s = argv[i];
        if(s=="-lat" && i+1<argc) lat = atof(argv[++i]);
        if(s=="-lon" && i+1<argc) lon = atof(argv[++i]);
    }

    time_t t = time(nullptr);
    tm *utc = gmtime(&t);
    // compute julian day at 0h UTC today
    tm midnight = *utc;
    midnight.tm_hour = 0; midnight.tm_min = 0; midnight.tm_sec = 0;
    time_t midnight_t = timegm(&midnight);
    double jd = toJulianDay(midnight_t);

    double decl, eqt;
    sunPosition(jd, decl, eqt);

    double noon_utc = 12.0 - eqt/60.0 - lon/15.0;
    double haSun = hourAngle(lat, decl, 90.833);
    double sunrise = noon_utc - haSun/15.0;
    double sunset = noon_utc + haSun/15.0;
    double haFajr = hourAngle(lat, decl, 90.0 + 18.0);
    double fajr = noon_utc - haFajr/15.0;
    double isha = noon_utc + haFajr/15.0;

    // Asr approximate: use same as above mid method if fails
    double asr = noon_utc + (haSun/15.0)/2.0;

    double qibla = computeQibla(lat, lon);

    // Output JSON
    cout << fixed;
    cout << "{\n";
    cout << "  \"location\": {\"lat\": " << lat << ", \"lon\": " << lon << "},\n";
    cout << "  \"qibla_bearing\": " << setprecision(6) << qibla << ",\n";
    cout << "  \"prayer_times\": {\n";
    cout << "    \"fajr\": \"" << hhmm(fajr) << "\",\n";
    cout << "    \"sunrise\": \"" << hhmm(sunrise) << "\",\n";
    cout << "    \"dhuhr\": \"" << hhmm(noon_utc) << "\",\n";
    cout << "    \"asr\": \"" << hhmm(asr) << "\",\n";
    cout << "    \"maghrib\": \"" << hhmm(sunset) << "\",\n";
    cout << "    \"isha\": \"" << hhmm(isha) << "\"\n";
    cout << "  }\n";
    cout << "}\n";
    return 0;
}
