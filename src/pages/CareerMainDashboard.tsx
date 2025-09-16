import React, { useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Tooltip, ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ScatterChart, Scatter, ZAxis } from 'recharts';
import jsPDF from 'jspdf';
import { downloadNodeAsPng } from '@/lib/utils';
import { Search, Filter } from 'lucide-react';

type RowData = { [key: string]: any };

// We'll use the student-list template superset to enable most dashboard metrics
const REQUIRED_COLUMNS = [
  'S.No','Reg Number','RollNo','Name','Dept','Section','PI','10th','12th','Diploma','CGPA','CutOff','Training Batch','Gender','Placed or Non Placed','Maximum Salary','Quota','Hosteller / Days scholar','Hosteller/Day Scholar'
];

const OPTIONAL_COMPANY_COLUMNS = [
  'Company Joined',
  // Company 1..10 names and salaries (as available)
  ...Array.from({ length: 10 }, (_, i) => `Company ${i+1}`),
  ...Array.from({ length: 10 }, (_, i) => `Salary (Company ${i+1})`),
  ...Array.from({ length: 10 }, (_, i) => `Organized By (Company ${i+1})`),
];

const TEMPLATE_HEADERS = [
  'S.No','Reg Number','RollNo','Name','Dept','Section','PI','10th','12th','Diploma','CGPA','CutOff','Training Batch','Gender','Placed or Non Placed','Maximum Salary','Quota','Hosteller / Days scholar','Company Joined',
  ...Array.from({ length: 10 }, (_, i) => `Company ${i+1}`),
  ...Array.from({ length: 10 }, (_, i) => `Salary (Company ${i+1})`),
  ...Array.from({ length: 10 }, (_, i) => `Organized By (Company ${i+1})`),
];

const normalize = (s: string) => s?.trim().replace(/\s+/g, ' ').replace(/\u00A0/g, ' ');
const toNumber = (v: any): number => {
  const n = Number(String(v).toString().replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const isPlaced = (v: any) => String(v || '').toLowerCase().includes('placed');

const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#22c55e', '#eab308'];

const CompanyKeys = {
  companyNames: (row: RowData): string[] => {
    const names: string[] = [];
    const joined = String(row['Company Joined'] || '').trim();
    if (joined) names.push(joined);
    for (let i = 1; i <= 10; i++) {
      const key = `Company ${i}`;
      const name = String(row[key] || '').trim();
      if (name) names.push(name);
    }
    return names;
  },
  companySalaries: (row: RowData): number[] => {
    const vals: number[] = [];
    const maxSal = toNumber(row['Maximum Salary']);
    if (maxSal) vals.push(maxSal);
    for (let i = 1; i <= 10; i++) {
      const key = `Salary (Company ${i})`;
      const v = toNumber(row[key]);
      if (v) vals.push(v);
    }
    return vals;
  },
};

const CareerMainDashboard: React.FC = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<RowData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);

  // Filters
  const [dept, setDept] = useState<string>('all');
  const [batch, setBatch] = useState<string>('all');
  const [pi, setPi] = useState<string>('all');
  const [incharge, setIncharge] = useState<string>('all');
  const [placedFilter, setPlacedFilter] = useState<string>('all');
  const [gender, setGender] = useState<string>('all');
  const [quota, setQuota] = useState<string>('all');
  const [hostelType, setHostelType] = useState<string>('all');
  const [company, setCompany] = useState<string>('all');
  const [search, setSearch] = useState('');

  if (!profile || (profile.role !== 'cdc_director' && profile.role !== 'faculty')) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-destructive mb-2">Access Denied</h1>
        <p className="text-muted-foreground">Only CDC Director and Faculty can access this page.</p>
      </div>
    );
  }

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'career_main_dashboard_template.xlsx');
  };

  const handleFile = async (file: File) => {
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['xlsx', 'csv'].includes(ext || '')) {
        toast({ title: 'Invalid file', description: 'Please upload a .xlsx or .csv file', variant: 'destructive' });
        return;
      }
      let data: RowData[] = [];
      let fileHeaders: string[] = [];
      if (ext === 'csv') {
        const text = await file.text();
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        const parsed = result.data as RowData[];
        data = parsed.map(r => { const m: RowData = {}; Object.entries(r).forEach(([k,v])=>{ m[normalize(k)] = v; }); return m; });
        fileHeaders = Object.keys(parsed[0] || {}).map(normalize);
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' }) as RowData[];
        data = json.map(r => { const m: RowData = {}; Object.entries(r).forEach(([k,v])=>{ m[normalize(k)] = v; }); return m; });
        fileHeaders = Object.keys(json[0] || {}).map(normalize);
      }
      // Validate presence of all REQUIRED_COLUMNS
      const missing = REQUIRED_COLUMNS.filter(c => !fileHeaders.includes(c));
      if (missing.length) {
        toast({ title: 'Validation failed', description: `Missing columns: ${missing.join(', ')}`, variant: 'destructive' });
        return;
      }
      setRows(data);
      setHeaders(fileHeaders);
      toast({ title: 'Upload successful', description: `${data.length} records loaded` });
    } catch (e: any) {
      toast({ title: 'Parse error', description: e.message || 'Failed to parse file', variant: 'destructive' });
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) handleFile(f);
  };

  const deptOptions = useMemo(() => Array.from(new Set(rows.map(r => r['Dept']).filter(Boolean))) as string[], [rows]);
  const batchOptions = useMemo(() => Array.from(new Set(rows.map(r => r['Training Batch']).filter(Boolean))) as string[], [rows]);
  const piOptions = useMemo(() => Array.from(new Set(rows.map(r => r['PI']).filter(Boolean))) as string[], [rows]);
  const inchargeOptions = useMemo(() => Array.from(new Set(rows.map(r => r['Incharge']).filter(Boolean))) as string[], [rows]);
  const companyOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => CompanyKeys.companyNames(r).forEach(n => set.add(n)));
    return Array.from(set);
  }, [rows]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return rows.filter(r => {
      const matchesDept = dept === 'all' ? true : String(r['Dept']) === dept;
      const matchesBatch = batch === 'all' ? true : String(r['Training Batch']) === batch;
      const matchesPi = pi === 'all' ? true : String(r['PI']) === pi;
      const matchesIncharge = incharge === 'all' ? true : String(r['Incharge']) === incharge;
      const matchesPlaced = placedFilter === 'all' ? true : placedFilter === 'placed' ? isPlaced(r['Placed or Non Placed']) : !isPlaced(r['Placed or Non Placed']);
      const matchesGender = gender === 'all' ? true : String(r['Gender']).toLowerCase() === gender.toLowerCase();
      const q = String(r['Quota'] || '').toLowerCase();
      const matchesQuota = quota === 'all' ? true : q.includes(quota.toLowerCase());
      const ht = String(r['Hosteller / Days scholar'] || r['Hosteller/Day Scholar'] || '').toLowerCase();
      const matchesHostel = hostelType === 'all' ? true : hostelType === 'Hostel' || hostelType === 'Hosteller' ? ht.includes('hostel') : ht.includes('day');
      const companyNames = CompanyKeys.companyNames(r).map(x=>x.toLowerCase());
      const matchesCompany = company === 'all' ? true : companyNames.includes(company.toLowerCase());
      const matchesSearch = s ? (String(r['Name']).toLowerCase().includes(s) || String(r['Reg Number']).toLowerCase().includes(s) || companyNames.some(n=>n.includes(s))) : true;
      return matchesDept && matchesBatch && matchesPi && matchesIncharge && matchesPlaced && matchesGender && matchesQuota && matchesHostel && matchesCompany && matchesSearch;
    });
  }, [rows, dept, batch, pi, incharge, placedFilter, gender, quota, hostelType, company, search]);

  const metrics = useMemo(() => {
    const total = filtered.length;
    const placedCount = filtered.filter(r => isPlaced(r['Placed or Non Placed'])).length;
    const nonPlaced = total - placedCount;
    const placementPct = total ? Math.round((placedCount/total)*100) : 0;

    // Dept wise totals and placed
    const deptMap = new Map<string, { total: number; placed: number; salary: number[] }>();
    filtered.forEach(r => {
      const d = String(r['Dept']||'NA');
      const cur = deptMap.get(d) || { total: 0, placed: 0, salary: [] };
      cur.total++;
      if (isPlaced(r['Placed or Non Placed'])) cur.placed++;
      const sals = CompanyKeys.companySalaries(r);
      if (sals.length) cur.salary.push(...sals);
      deptMap.set(d, cur);
    });
    const deptStack = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, total: v.total, placed: v.placed }));
    const deptTotalsPie = Array.from(deptMap.entries()).map(([dept, v]) => ({ name: dept, value: v.total }));
    const packageByDept = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, avg: v.salary.length ? Math.round(v.salary.reduce((a,b)=>a+b,0)/v.salary.length) : 0 }));
    const top5DeptByPct = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, pct: v.total ? Math.round((v.placed/v.total)*100) : 0 })).sort((a,b)=>b.pct-a.pct).slice(0,5);

    // Gender-wise ratio
    const gMap = new Map<string, { total: number; placed: number; sumPkg: number; countPkg: number }>();
    filtered.forEach(r => { const g = String(r['Gender']||'NA'); const cur = gMap.get(g) || { total: 0, placed: 0, sumPkg: 0, countPkg: 0 }; cur.total++; if (isPlaced(r['Placed or Non Placed'])) cur.placed++; const ms = toNumber(r['Maximum Salary']); if (ms){ cur.sumPkg+=ms; cur.countPkg++; } gMap.set(g, cur); });
    const genderRatio = Array.from(gMap.entries()).map(([gender, v]) => ({ gender, placed: v.placed, total: v.total, avgPkg: v.countPkg ? Math.round(v.sumPkg/v.countPkg) : 0 }));

    // Quota split
    const qMap = new Map<string, { total: number; placed: number; sumPkg: number; countPkg: number }>();
    filtered.forEach(r => { const q = String(r['Quota']||'NA'); const cur = qMap.get(q) || { total: 0, placed: 0, sumPkg: 0, countPkg: 0 }; cur.total++; if (isPlaced(r['Placed or Non Placed'])) cur.placed++; const ms = toNumber(r['Maximum Salary']); if (ms){ cur.sumPkg+=ms; cur.countPkg++; } qMap.set(q, cur); });
    const quotaSplit = Array.from(qMap.entries()).map(([quota, v]) => ({ quota, total: v.total, placed: v.placed, avgPkg: v.countPkg? Math.round(v.sumPkg/v.countPkg):0 }));

    // Hostel vs Day Scholar
    const hMap = new Map<string, { total: number; placed: number; sumPkg: number; countPkg: number }>();
    filtered.forEach(r => { const h = String(r['Hosteller / Days scholar'] || r['Hosteller/Day Scholar'] || 'NA'); const cur = hMap.get(h) || { total: 0, placed: 0, sumPkg: 0, countPkg: 0 }; cur.total++; if (isPlaced(r['Placed or Non Placed'])) cur.placed++; const ms = toNumber(r['Maximum Salary']); if (ms){ cur.sumPkg+=ms; cur.countPkg++; } hMap.set(h, cur); });
    const hostelVsDay = Array.from(hMap.entries()).map(([type, v]) => ({ type, total: v.total, placed: v.placed, avgPkg: v.countPkg? Math.round(v.sumPkg/v.countPkg):0 }));

    // Company-wise top recruiters + avg package (from student rows)
    const cMap = new Map<string, { count: number; sumPkg: number; countPkg: number }>();
    filtered.forEach(r => {
      const names = CompanyKeys.companyNames(r);
      const pkgs = CompanyKeys.companySalaries(r);
      names.forEach(n => {
        const cur = cMap.get(n) || { count: 0, sumPkg: 0, countPkg: 0 };
        cur.count++;
        if (pkgs.length) { cur.sumPkg += pkgs[0]; cur.countPkg++; }
        cMap.set(n, cur);
      });
    });
    const topRecruiters = Array.from(cMap.entries()).map(([company, v]) => ({ company, hires: v.count })).sort((a,b)=>b.hires-a.hires).slice(0, 15);
    const avgPkgByCompany = Array.from(cMap.entries()).map(([company, v]) => ({ company, avg: v.countPkg ? Math.round(v.sumPkg/v.countPkg) : 0 })).slice(0, 20);

    // Multi-offer trend & training batch vs placement %
    const offerMap = new Map<number, number>();
    filtered.forEach(r => { let offers = 0; for (let i=1;i<=10;i++){ if (String(r[`Company ${i}`]||'').trim()) offers++; } offerMap.set(offers, (offerMap.get(offers)||0)+1); });
    const multiOfferTrend = Array.from(offerMap.entries()).sort((a,b)=>a[0]-b[0]).map(([offers, count])=>({ offers: String(offers), count }));

    const batchMap = new Map<string, { total: number; placed: number }>();
    filtered.forEach(r => { const b = String(r['Training Batch']||'NA'); const cur = batchMap.get(b)||{ total:0, placed:0 }; cur.total++; if (isPlaced(r['Placed or Non Placed'])) cur.placed++; batchMap.set(b, cur); });
    const batchPlacementPct = Array.from(batchMap.entries()).map(([batch, v])=>({ batch, pct: v.total ? Math.round((v.placed/v.total)*100) : 0 }));

    // High salary vs avg salary trend (by batch)
    const batchSalaryMap = new Map<string, { max: number; sum: number; count: number }>();
    filtered.forEach(r => { const b = String(r['Training Batch']||'NA'); const ms = toNumber(r['Maximum Salary']); const cur = batchSalaryMap.get(b)||{ max:0, sum:0, count:0 }; if (ms>cur.max) cur.max=ms; if (ms){ cur.sum+=ms; cur.count++; } batchSalaryMap.set(b, cur); });
    const salaryTrend = Array.from(batchSalaryMap.entries()).map(([batch, v])=>({ batch, high: v.max, avg: v.count ? Math.round(v.sum/v.count) : 0 }));

    // Radar - All Dept Performance (placed % scaled)
    const radarData = Array.from(deptMap.entries()).map(([dept, v]) => ({ subject: dept, A: v.total ? Math.round((v.placed/v.total)*100) : 0, fullMark: 100 }));

    return {
      total, placedCount, nonPlaced, placementPct,
      deptStack, deptTotalsPie, genderRatio, quotaSplit, hostelVsDay,
      topRecruiters, packageByDept, avgPkgByCompany, top5DeptByPct,
      multiOfferTrend, batchPlacementPct, salaryTrend, radarData
    };
  }, [filtered]);

  const exportFilteredToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filtered);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Filtered');
    XLSX.writeFile(wb, 'career_main_dashboard_filtered.xlsx');
  };

  const exportFilteredToPdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 40; let y = margin;
    doc.setFontSize(14); doc.text('Career - Main Dashboard (Filtered)', margin, y); y += 20;
    doc.setFontSize(9);
    const cols = headers.length ? headers : TEMPLATE_HEADERS;
    let x = margin;
    cols.slice(0, 8).forEach(h => { doc.text(String(h), x, y); x += 80; }); y += 14;
    doc.setLineWidth(0.5); doc.line(margin, y, 555, y); y += 8;
    filtered.slice(0, 60).forEach(r => {
      let cx = margin;
      cols.slice(0, 8).forEach(h => { const txt = String(r[h] ?? ''); doc.text(txt.length > 14 ? txt.slice(0, 14) + '…' : txt, cx, y); cx += 80; });
      y += 14;
      if (y > 780) { doc.addPage(); y = margin; }
    });
    doc.save('career_main_dashboard_filtered.pdf');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Career Data Visualization</h1>
          <p className="text-muted-foreground">Unified dashboard across students, companies, quota, gender and more</p>
        </div>
        <div className="flex items-center gap-2">
          <Input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={onFileChange} />
          <Button variant="outline" onClick={()=>fileRef.current?.click()}>Upload</Button>
          <Button variant="outline" onClick={downloadTemplate}>Download Template</Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-left">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Name / Reg No / Company" className="pl-10 h-10 border border-indigo-300" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-left">Dept</Label>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="h-10 border border-indigo-300"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {deptOptions.map(d => (<SelectItem key={d} value={String(d)}>{String(d)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-left">Batch</Label>
            <Select value={batch} onValueChange={setBatch}>
              <SelectTrigger className="h-10 border border-indigo-300"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {batchOptions.map(b => (<SelectItem key={b} value={String(b)}>{String(b)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-left">PI</Label>
            <Select value={pi} onValueChange={setPi}>
              <SelectTrigger className="h-10 border border-indigo-300"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {piOptions.map(p => (<SelectItem key={p} value={String(p)}>{String(p)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-left">Incharge</Label>
            <Select value={incharge} onValueChange={setIncharge}>
              <SelectTrigger className="h-10 border border-indigo-300"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {inchargeOptions.map(i => (<SelectItem key={i} value={String(i)}>{String(i)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-left">Placed</Label>
            <Select value={placedFilter} onValueChange={setPlacedFilter}>
              <SelectTrigger className="h-10 border border-indigo-300"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="placed">Placed</SelectItem>
                <SelectItem value="not">Not Placed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-left">Gender</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger className="h-10 border border-indigo-300"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-left">Quota</Label>
            <Select value={quota} onValueChange={setQuota}>
              <SelectTrigger className="h-10 border border-indigo-300"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="MQ">MQ</SelectItem>
                <SelectItem value="GQ">GQ</SelectItem>
                <SelectItem value="International">International</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-left">Hosteller/Day Scholar</Label>
            <Select value={hostelType} onValueChange={setHostelType}>
              <SelectTrigger className="h-10 border border-indigo-300"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Hosteller">Hosteller</SelectItem>
                <SelectItem value="Day Scholar">Day Scholar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-left">Company</Label>
            <Select value={company} onValueChange={setCompany}>
              <SelectTrigger className="h-10 border border-indigo-300"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {companyOptions.map(c => (<SelectItem key={c} value={String(c)}>{String(c)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2 lg:col-span-2">
            <Button variant="outline" onClick={exportFilteredToExcel}>Export Excel</Button>
            <Button variant="outline" onClick={exportFilteredToPdf}>Export PDF</Button>
          </div>
        </CardContent>
      </Card>

      {/* 15 Core Dashboard Charts */}
      {filtered.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Overall Placement Percentage</CardTitle>
                <Button variant="outline" size="sm" onClick={()=>{ const el=document.getElementById('chart-overall'); if(el) downloadNodeAsPng(el,'overall-placement'); }}>Download PNG</Button>
              </div>
            </CardHeader>
            <CardContent id="chart-overall">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie dataKey="value" data={[{ name: 'Placed %', value: metrics.placementPct }, { name: 'Remaining', value: 100 - metrics.placementPct }]} cx="50%" cy="50%" innerRadius={60} outerRadius={100}>
                    {[0,1].map((_,i)=>(<Cell key={i} fill={i===0?'#10b981':'#e5e7eb'} />))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Dept-wise Student Strength vs Placed</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={metrics.deptStack}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" stackId="a" fill="#3b82f6" />
                  <Bar dataKey="placed" stackId="a" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Gender-wise Placement Ratio</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.genderRatio}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="gender" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="placed" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Quota-wise Placement Split</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.quotaSplit}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="quota" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="placed" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Hostel vs Day Scholar Placement Comparison</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.hostelVsDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="placed" fill="#06b6d4" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Top Recruiters</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.topRecruiters}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="company" interval={0} angle={-30} textAnchor="end" height={70} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="hires" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Package Distribution by Dept (Average)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.packageByDept}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avg" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Average Package by Company</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metrics.avgPkgByCompany}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="company" interval={0} angle={-30} textAnchor="end" height={70} />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="avg" stroke="#10b981" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Top 5 Depts with Highest Placement %</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={metrics.top5DeptByPct}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" />
                  <YAxis domain={[0,100]} />
                  <Tooltip />
                  <Bar dataKey="pct" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Overall Student Distribution by Dept</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie dataKey="value" data={metrics.deptTotalsPie} cx="50%" cy="50%" outerRadius={100} label>
                    {metrics.deptTotalsPie.map((_,i)=>(<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Multi-Company Offer Trend</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={metrics.multiOfferTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="offers" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Training Batch vs Placement %</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={metrics.batchPlacementPct}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="batch" />
                  <YAxis domain={[0,100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="pct" stroke="#3b82f6" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>High Salary vs Average Salary Trend (by Batch)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={metrics.salaryTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="batch" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="high" fill="#ef4444" />
                  <Bar dataKey="avg" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Placed vs Non-Placed Students</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie dataKey="value" data={[{ name: 'Placed', value: metrics.placedCount }, { name: 'Non-Placed', value: metrics.nonPlaced }]} cx="50%" cy="50%" outerRadius={90} label>
                    {[0,1].map((_,i)=>(<Cell key={i} fill={i===0?'#10b981':'#ef4444'} />))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>All Dept Performance (Radar)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={360}>
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={metrics.radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  <Radar name="Placement %" dataKey="A" stroke="#3b82f6" fill="#93c5fd" fillOpacity={0.6} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default CareerMainDashboard;


