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
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import jsPDF from 'jspdf';
import { Search, Filter } from 'lucide-react';

type RowData = { [key: string]: any };

const REQUIRED_COLUMNS = [
  'S.No','Dept','Total','PI','Total Male','PI Male','Total Female','PI Female','Placed Male','Placed Female','Male Placed %','Female Placed %','Total %','Package','Gender','Batch'
];

const TEMPLATE_HEADERS = REQUIRED_COLUMNS;

const normalize = (s: string) => s?.trim().replace(/\s+/g, ' ').replace(/\u00A0/g, ' ');
const toNumber = (v: any): number => {
  const n = Number(String(v).toString().replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#22c55e', '#eab308'];

const CareerGenderAnalysis: React.FC = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<RowData[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState<string>('all');
  const [batch, setBatch] = useState<string>('all');
  const [pi, setPi] = useState<string>('all');
  const [gender, setGender] = useState<string>('all');
  const [placed, setPlaced] = useState<string>('all'); // all | placed | not

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
    XLSX.writeFile(wb, 'career_gender_analysis_template.xlsx');
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
        data = parsed.map(r => {
          const m: RowData = {}; Object.entries(r).forEach(([k,v])=>{ m[normalize(k)] = v; }); return m;
        });
        fileHeaders = Object.keys(parsed[0] || {}).map(normalize);
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' }) as RowData[];
        data = json.map(r => { const m: RowData = {}; Object.entries(r).forEach(([k,v])=>{ m[normalize(k)] = v; }); return m; });
        fileHeaders = Object.keys(json[0] || {}).map(normalize);
      }
      const missing = REQUIRED_COLUMNS.filter(c => !fileHeaders.includes(c));
      if (missing.length) {
        toast({ title: 'Validation failed', description: `Missing columns: ${missing.join(', ')}`, variant: 'destructive' });
        return;
      }
      setRows(data);
      toast({ title: 'Upload successful', description: `${data.length} records loaded` });
    } catch (e: any) {
      toast({ title: 'Parse error', description: e.message || 'Failed to parse file', variant: 'destructive' });
    }
  };

  const filtered = useMemo(() => {
    const searchLower = search.toLowerCase();
    return rows.filter(r => {
      const matchesSearch = search ? Object.values(r).some(v => String(v).toLowerCase().includes(searchLower)) : true;
      const matchesDept = dept === 'all' ? true : String(r['Dept']) === dept;
      const matchesBatch = batch === 'all' ? true : String(r['Batch']) === batch;
      const matchesPi = pi === 'all' ? true : String(r['PI']) === pi;
      const matchesGender = gender === 'all' ? true : String(r['Gender']).toLowerCase() === gender.toLowerCase();
      const placedCount = toNumber(r['Placed Male']) + toNumber(r['Placed Female']);
      const matchesPlaced = placed === 'all' ? true : placed === 'placed' ? placedCount > 0 : placedCount === 0;
      return matchesSearch && matchesDept && matchesBatch && matchesPi && matchesGender && matchesPlaced;
    });
  }, [rows, search, dept, batch, pi, gender, placed]);

  const departments = useMemo(() => Array.from(new Set(rows.map(r => r['Dept']).filter(Boolean))) as string[], [rows]);
  const batches = useMemo(() => Array.from(new Set(rows.map(r => r['Batch']).filter(Boolean))) as string[], [rows]);
  const pis = useMemo(() => Array.from(new Set(rows.map(r => r['PI']).filter(Boolean))) as string[], [rows]);

  const metrics = useMemo(() => {
    // Dept aggregates
    const deptMap = new Map<string, { male: number; female: number; placedMale: number; placedFemale: number; malePct: number; femalePct: number; totalPlaced: number; total: number; pkgMale: number[]; pkgFemale: number[] }>();
    filtered.forEach(r => {
      const d = String(r['Dept'] || 'NA');
      const cur = deptMap.get(d) || { male: 0, female: 0, placedMale: 0, placedFemale: 0, malePct: 0, femalePct: 0, totalPlaced: 0, total: 0, pkgMale: [], pkgFemale: [] };
      cur.male += toNumber(r['Total Male']);
      cur.female += toNumber(r['Total Female']);
      cur.placedMale += toNumber(r['Placed Male']);
      cur.placedFemale += toNumber(r['Placed Female']);
      cur.malePct += toNumber(r['Male Placed %']);
      cur.femalePct += toNumber(r['Female Placed %']);
      cur.totalPlaced += toNumber(r['Placed Male']) + toNumber(r['Placed Female']);
      cur.total += toNumber(r['Total']);
      // package by gender (if Gender column exists for row-level)
      const pkg = toNumber(r['Package']);
      const g = String(r['Gender'] || '').toLowerCase();
      if (g === 'male') cur.pkgMale.push(pkg);
      if (g === 'female') cur.pkgFemale.push(pkg);
      deptMap.set(d, cur);
    });

    const deptMaleFemaleTotal = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, male: v.male, female: v.female }));
    const deptPlacedStack = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, male: v.placedMale, female: v.placedFemale }));
    const deptMaleFemalePct = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, malePct: v.male ? Math.round((v.placedMale / v.male) * 100) : 0, femalePct: v.female ? Math.round((v.placedFemale / v.female) * 100) : 0 }));

    // Overall counts
    const totalMale = deptMaleFemaleTotal.reduce((s, d) => s + d.male, 0);
    const totalFemale = deptMaleFemaleTotal.reduce((s, d) => s + d.female, 0);
    const placedMale = deptPlacedStack.reduce((s, d) => s + d.male, 0);
    const placedFemale = deptPlacedStack.reduce((s, d) => s + d.female, 0);

    // PI-wise
    const piMap = new Map<string, { male: number; female: number }>();
    filtered.forEach(r => { const p = String(r['PI'] || 'NA'); const cur = piMap.get(p) || { male: 0, female: 0 }; cur.male += toNumber(r['Total Male']); cur.female += toNumber(r['Total Female']); piMap.set(p, cur); });
    const piStrength = Array.from(piMap.entries()).map(([pi, v]) => ({ pi, male: v.male, female: v.female }));

    // Batch-wise distribution and growth trend by gender
    const batchMap = new Map<string, { male: number; female: number; placedMale: number; placedFemale: number }>();
    filtered.forEach(r => { const b = String(r['Batch'] || 'NA'); const cur = batchMap.get(b) || { male: 0, female: 0, placedMale: 0, placedFemale: 0 }; cur.male += toNumber(r['Total Male']); cur.female += toNumber(r['Total Female']); cur.placedMale += toNumber(r['Placed Male']); cur.placedFemale += toNumber(r['Placed Female']); batchMap.set(b, cur); });
    const batchDistribution = Array.from(batchMap.entries()).map(([batch, v]) => ({ batch, male: v.male, female: v.female }));
    const genderGrowthTrend = Array.from(batchMap.entries()).map(([batch, v]) => ({ batch, placedMale: v.placedMale, placedFemale: v.placedFemale }));

    // Gender ratios and totals
    const overallGenderRatio = [
      { name: 'Male', value: totalMale },
      { name: 'Female', value: totalFemale }
    ];
    const totalVsPlacedByGender = [
      { gender: 'Male', total: totalMale, placed: placedMale },
      { gender: 'Female', total: totalFemale, placed: placedFemale }
    ];

    // Average package by gender per dept
    const avgPkgByGenderDept = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, male: v.pkgMale.length ? Math.round(v.pkgMale.reduce((a,b)=>a+b,0)/v.pkgMale.length) : 0, female: v.pkgFemale.length ? Math.round(v.pkgFemale.reduce((a,b)=>a+b,0)/v.pkgFemale.length) : 0 }));

    // Top 5 departments by female/male placement %
    const topFemalePct = [...deptMaleFemalePct].sort((a,b)=>b.femalePct - a.femalePct).slice(0,5);
    const topMalePct = [...deptMaleFemalePct].sort((a,b)=>b.malePct - a.malePct).slice(0,5);

    // Gender contribution to overall placement % (stacked area)
    const contribution = Array.from(batchMap.entries()).map(([batch, v]) => {
      const total = (v.male + v.female) || 1;
      const pctMale = Math.round((v.placedMale / total) * 100);
      const pctFemale = Math.round((v.placedFemale / total) * 100);
      return { batch, pctMale, pctFemale };
    });

    // Overall summary gauge-like values
    const overallPlaced = placedMale + placedFemale;
    const overallTotal = totalMale + totalFemale;
    const overallPct = overallTotal ? Math.round((overallPlaced / overallTotal) * 100) : 0;

    return {
      deptMaleFemaleTotal,
      deptPlacedStack,
      deptMaleFemalePct,
      totalMale, totalFemale, placedMale, placedFemale,
      piStrength,
      batchDistribution,
      genderGrowthTrend,
      overallGenderRatio,
      totalVsPlacedByGender,
      avgPkgByGenderDept,
      topFemalePct,
      topMalePct,
      contribution,
      overallPct
    };
  }, [filtered]);

  const exportFilteredToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filtered);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Filtered');
    XLSX.writeFile(wb, 'career_gender_analysis_filtered.xlsx');
  };

  const exportFilteredToPdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 40; let y = margin;
    doc.setFontSize(14); doc.text('Career - Gender Analysis (Filtered)', margin, y); y += 20;
    doc.setFontSize(9);
    const cols = REQUIRED_COLUMNS;
    let x = margin;
    cols.forEach(h => { doc.text(String(h), x, y); x += 80; }); y += 14;
    doc.setLineWidth(0.5); doc.line(margin, y, 555, y); y += 8;
    filtered.slice(0, 60).forEach(r => {
      let cx = margin;
      cols.forEach(h => { const txt = String(r[h] ?? ''); doc.text(txt.length > 14 ? txt.slice(0, 14) + '…' : txt, cx, y); cx += 80; });
      y += 14;
      if (y > 780) { doc.addPage(); y = margin; }
    });
    doc.save('career_gender_analysis_filtered.pdf');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Career - Gender Analysis</h1>
          <p className="text-muted-foreground">Upload Excel/CSV and analyze gender-wise placements</p>
        </div>
        <div className="flex items-center gap-2">
          <Input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={(e)=>{ const f=e.target.files?.[0]; if (f) handleFile(f);} } />
          <Button variant="outline" onClick={()=>fileRef.current?.click()}>Upload</Button>
          <Button variant="outline" onClick={downloadTemplate}>Download Template</Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="space-y-2">
            <Label>Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search any text" className="pl-10 h-10 border border-indigo-300" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Dept</Label>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="h-10 border border-indigo-300"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {departments.map(d => (<SelectItem key={d} value={String(d)}>{String(d)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Batch</Label>
            <Select value={batch} onValueChange={setBatch}>
              <SelectTrigger className="h-10 border border-indigo-300"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {batches.map(b => (<SelectItem key={b} value={String(b)}>{String(b)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>PI</Label>
            <Select value={pi} onValueChange={setPi}>
              <SelectTrigger className="h-10 border border-indigo-300"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {pis.map(p => (<SelectItem key={p} value={String(p)}>{String(p)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Gender</Label>
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
            <Label>Placed</Label>
            <Select value={placed} onValueChange={setPlaced}>
              <SelectTrigger className="h-10 border border-indigo-300"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="placed">Placed</SelectItem>
                <SelectItem value="not">Not Placed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2 md:col-span-2">
            <Button variant="outline" onClick={exportFilteredToExcel}>Export Excel</Button>
            <Button variant="outline" onClick={exportFilteredToPdf}>Export PDF</Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Data ({filtered.length} rows)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    {REQUIRED_COLUMNS.map(h => (
                      <th key={h} className="p-2 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 400).map((r, idx) => (
                    <tr key={idx} className="border-t">
                      {REQUIRED_COLUMNS.map(h => (
                        <td key={h} className="p-2 whitespace-nowrap">{String(r[h] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Showing first 400 rows.</p>
          </CardContent>
        </Card>
      )}

      {/* Charts (15) */}
      {filtered.length > 0 && (
        <>
          <Card>
            <CardHeader><CardTitle>Dept-wise Male vs Female Total Students</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={metrics.deptMaleFemaleTotal}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="male" fill="#3b82f6" />
                  <Bar dataKey="female" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Dept-wise Placed Male vs Placed Female</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={metrics.deptPlacedStack}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="male" stackId="a" fill="#3b82f6" />
                  <Bar dataKey="female" stackId="a" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Male vs Female Placement Percentage</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="col-span-1">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie dataKey="value" data={[{ name: 'Male', value: metrics.placedMale }, { name: 'Female', value: metrics.placedFemale }]} cx="50%" cy="50%" innerRadius={60} outerRadius={100} label>
                      {[0,1].map((_,idx)=>(<Cell key={idx} fill={idx===0?'#3b82f6':'#ef4444'} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <p className="mt-2 text-xs text-muted-foreground text-center">Overall placed split</p>
              </div>
              <div className="col-span-1">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie dataKey="value" data={[{ name: 'Male %', value: metrics.totalMale ? Math.round((metrics.placedMale/metrics.totalMale)*100) : 0 }, { name: 'Female %', value: metrics.totalFemale ? Math.round((metrics.placedFemale/metrics.totalFemale)*100) : 0 }]} cx="50%" cy="50%" innerRadius={60} outerRadius={100} label>
                      {[0,1].map((_,idx)=>(<Cell key={idx} fill={idx===0?'#3b82f6':'#ef4444'} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <p className="mt-2 text-xs text-muted-foreground text-center">Placed percentage by gender</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Batch-wise Gender Distribution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.batchDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="batch" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="male" fill="#3b82f6" />
                  <Bar dataKey="female" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>PI vs Male/Female Strength</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.piStrength}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="pi" interval={0} angle={-30} textAnchor="end" height={70} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="male" fill="#3b82f6" />
                  <Bar dataKey="female" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Dept-wise Male Placement % vs Female Placement %</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={metrics.deptMaleFemalePct}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis domain={[0,100]} />
                  <Tooltip />
                  <Bar dataKey="malePct" fill="#3b82f6" />
                  <Bar dataKey="femalePct" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Total Students vs Placed Students by Gender</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.totalVsPlacedByGender}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="gender" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill="#06b6d4" />
                  <Bar dataKey="placed" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Overall Gender Ratio</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie dataKey="value" data={metrics.overallGenderRatio} cx="50%" cy="50%" innerRadius={60} outerRadius={100} label>
                    {metrics.overallGenderRatio.map((_,idx)=>(<Cell key={idx} fill={idx===0?'#3b82f6':'#ef4444'} />))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Dept-wise Average Package by Gender</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.avgPkgByGenderDept}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="male" fill="#3b82f6" />
                  <Bar dataKey="female" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Top 5 Depts with Highest Female Placement %</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={metrics.topFemalePct}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis domain={[0,100]} />
                  <Tooltip />
                  <Bar dataKey="femalePct" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Top 5 Depts with Highest Male Placement %</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={metrics.topMalePct}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis domain={[0,100]} />
                  <Tooltip />
                  <Bar dataKey="malePct" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Placement Growth Trend by Gender Across Batches</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={metrics.genderGrowthTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="batch" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="placedMale" stroke="#3b82f6" />
                  <Line type="monotone" dataKey="placedFemale" stroke="#ef4444" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Gender Contribution to Overall Placement %</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={metrics.contribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="batch" />
                  <YAxis domain={[0,100]} />
                  <Tooltip />
                  <Area type="monotone" dataKey="pctMale" stackId="1" stroke="#3b82f6" fill="#93c5fd" />
                  <Area type="monotone" dataKey="pctFemale" stackId="1" stroke="#ef4444" fill="#fca5a5" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Overall Summary Gauge</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie dataKey="value" data={[{ name: 'Placed %', value: metrics.overallPct }, { name: 'Remaining', value: 100 - metrics.overallPct }]} cx="50%" cy="50%" innerRadius={60} outerRadius={100}>
                    {[0,1].map((_, idx) => (<Cell key={idx} fill={idx===0 ? '#10b981' : '#e5e7eb'} />))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default CareerGenderAnalysis;


