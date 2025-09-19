import React, { useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Tooltip, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}
import { Search, Filter, Download, Upload, FileSpreadsheet, BarChart3, TrendingUp } from 'lucide-react';

type RowData = { [key: string]: any };

const REQUIRED_COLUMNS = [
  'S.No','Dept','Total','PI','Total Hostl','PI Hostl','Placed Hostl','Placed Days','Hostl Placed %','Days Placed %','Total %','Hosteller/Day Scholar'
];
const OPTIONAL_COLUMNS = ['Batch','Incharge','Package'];
const TEMPLATE_HEADERS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

const normalize = (s: string) => s?.trim().replace(/\s+/g, ' ').replace(/\u00A0/g, ' ');
const toNumber = (v: any): number => {
  const n = Number(String(v).toString().replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#22c55e', '#eab308'];

const CareerHostelDayScholarAnalysis: React.FC = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<RowData[]>([]);

  const [search, setSearch] = useState('');
  const [dept, setDept] = useState<string>('all');
  const [batch, setBatch] = useState<string>('all');
  const [pi, setPi] = useState<string>('all');
  const [incharge, setIncharge] = useState<string>('all');
  const [hostelType, setHostelType] = useState<string>('all'); // Hosteller | Day Scholar
  const [placed, setPlaced] = useState<string>('all');
  const [packageMin, setPackageMin] = useState('');
  const [packageMax, setPackageMax] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

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
    XLSX.writeFile(wb, 'career_hostel_day_scholar_template.xlsx');
  };

  const handleFile = async (file: File) => {
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['xlsx', 'csv'].includes(ext || '')) {
        toast({ title: 'Invalid file', description: 'Please upload a .xlsx or .csv file', variant: 'destructive' });
        return;
      }
      let data: RowData[] = [];
      let headers: string[] = [];
      if (ext === 'csv') {
        const text = await file.text();
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        const parsed = result.data as RowData[];
        data = parsed.map(r => { const m: RowData = {}; Object.entries(r).forEach(([k,v])=>{ m[normalize(k)] = v; }); return m; });
        headers = Object.keys(parsed[0] || {}).map(normalize);
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' }) as RowData[];
        data = json.map(r => { const m: RowData = {}; Object.entries(r).forEach(([k,v])=>{ m[normalize(k)] = v; }); return m; });
        headers = Object.keys(json[0] || {}).map(normalize);
      }
      const missing = REQUIRED_COLUMNS.filter(c => !headers.includes(c));
      if (missing.length) {
        toast({ title: 'Validation failed', description: `Missing columns: ${missing.join(', ')}`, variant: 'destructive' });
        return;
      }
      setRows(data);
      setCurrentPage(1);
      toast({ title: 'Upload successful', description: `${data.length} records loaded` });
    } catch (e: any) {
      toast({ title: 'Parse error', description: e.message || 'Failed to parse file', variant: 'destructive' });
    }
  };

  const filteredRows = useMemo(() => {
    const searchLower = search.toLowerCase();
    return rows.filter(r => {
      const matchesSearch = search ? Object.values(r).some(v => String(v).toLowerCase().includes(searchLower)) : true;
      const matchesDept = dept === 'all' ? true : String(r['Dept']) === dept;
      const matchesBatch = batch === 'all' ? true : String(r['Batch']) === batch;
      const matchesPi = pi === 'all' ? true : String(r['PI']) === pi;
      const matchesIncharge = incharge === 'all' ? true : String(r['Incharge']) === incharge;
      const typeVal = String(r['Hosteller/Day Scholar'] || '').toLowerCase();
      const matchesType = hostelType === 'all' ? true : hostelType === 'Hosteller' ? typeVal.includes('hostel') : typeVal.includes('day');
      const placedSum = toNumber(r['Placed Hostl']) + toNumber(r['Placed Days']);
      const matchesPlaced = placed === 'all' ? true : placed === 'placed' ? placedSum > 0 : placedSum === 0;
      
      const packageValue = toNumber(r['Package']);
      const matchesPackageMin = !packageMin || packageValue >= toNumber(packageMin);
      const matchesPackageMax = !packageMax || packageValue <= toNumber(packageMax);
      
      return matchesSearch && matchesDept && matchesBatch && matchesPi && matchesIncharge && matchesType && matchesPlaced && matchesPackageMin && matchesPackageMax;
    });
  }, [rows, search, dept, batch, pi, incharge, hostelType, placed, packageMin, packageMax]);

  const departments = useMemo(() => Array.from(new Set(rows.map(r => r['Dept']).filter(Boolean))) as string[], [rows]);
  const batches = useMemo(() => Array.from(new Set(rows.map(r => r['Batch']).filter(Boolean))) as string[], [rows]);
  const pis = useMemo(() => Array.from(new Set(rows.map(r => r['PI']).filter(Boolean))) as string[], [rows]);
  const incharges = useMemo(() => Array.from(new Set(rows.map(r => r['Incharge']).filter(Boolean))) as string[], [rows]);

  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const metrics = useMemo(() => {
    // Dept aggregates
    const deptMap = new Map<string, { hostl: number; days: number; placedHostl: number; placedDays: number; pctHostl: number; pctDays: number; count: number; pkgHostl: number[]; pkgDays: number[] }>();
    filteredRows.forEach(r => {
      const d = String(r['Dept'] || 'NA');
      const cur = deptMap.get(d) || { hostl: 0, days: 0, placedHostl: 0, placedDays: 0, pctHostl: 0, pctDays: 0, count: 0, pkgHostl: [], pkgDays: [] };
      cur.hostl += toNumber(r['Total Hostl']);
      cur.days += Math.max(0, toNumber(r['Total']) - toNumber(r['Total Hostl']));
      cur.placedHostl += toNumber(r['Placed Hostl']);
      cur.placedDays += toNumber(r['Placed Days']);
      cur.pctHostl += toNumber(r['Hostl Placed %']);
      cur.pctDays += toNumber(r['Days Placed %']);
      const pkg = toNumber(r['Package']);
      const typeVal = String(r['Hosteller/Day Scholar'] || '').toLowerCase();
      if (typeVal.includes('hostel')) cur.pkgHostl.push(pkg); else if (typeVal.includes('day')) cur.pkgDays.push(pkg);
      cur.count += 1; deptMap.set(d, cur);
    });

    const deptStrength = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, hostl: v.hostl, days: v.days }));
    const deptPlacedStack = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, hostl: v.placedHostl, days: v.placedDays }));
    const deptPctBars = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, hostlPct: v.count? Math.round(v.pctHostl/v.count):0, daysPct: v.count? Math.round(v.pctDays/v.count):0 }));
    const avgPkgByDeptType = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, hostl: v.pkgHostl.length? Math.round(v.pkgHostl.reduce((a,b)=>a+b,0)/v.pkgHostl.length):0, days: v.pkgDays.length? Math.round(v.pkgDays.reduce((a,b)=>a+b,0)/v.pkgDays.length):0 }));

    // Overall totals
    const totalHostl = deptStrength.reduce((s,d)=>s+d.hostl,0);
    const totalDays = deptStrength.reduce((s,d)=>s+d.days,0);
    const placedHostl = deptPlacedStack.reduce((s,d)=>s+d.hostl,0);
    const placedDays = deptPlacedStack.reduce((s,d)=>s+d.days,0);
    const overallRatio = [ { name: 'Hosteller', value: totalHostl }, { name: 'Day Scholar', value: totalDays } ];
    const totalVsPlacedByType = [ { type: 'Hosteller', total: totalHostl, placed: placedHostl }, { type: 'Day Scholar', total: totalDays, placed: placedDays } ];

    // PI-wise ratio
    const piMap = new Map<string, { hostl: number; days: number }>();
    filteredRows.forEach(r => { const p = String(r['PI'] || 'NA'); const cur = piMap.get(p) || { hostl: 0, days: 0 }; cur.hostl += toNumber(r['Total Hostl']); cur.days += Math.max(0, toNumber(r['Total']) - toNumber(r['Total Hostl'])); piMap.set(p, cur); });
    const piRatio = Array.from(piMap.entries()).map(([pi, v]) => ({ pi, hostl: v.hostl, days: v.days }));

    // Batch distribution and growth trend
    const batchMap = new Map<string, { hostl: number; days: number; placedHostl: number; placedDays: number }>();
    filteredRows.forEach(r => { const b = String(r['Batch'] || 'NA'); const cur = batchMap.get(b) || { hostl: 0, days: 0, placedHostl: 0, placedDays: 0 }; cur.hostl += toNumber(r['Total Hostl']); cur.days += Math.max(0, toNumber(r['Total']) - toNumber(r['Total Hostl'])); cur.placedHostl += toNumber(r['Placed Hostl']); cur.placedDays += toNumber(r['Placed Days']); batchMap.set(b, cur); });
    const batchDist = Array.from(batchMap.entries()).map(([batch, v]) => ({ batch, hostl: v.hostl, days: v.days }));
    const growthTrend = Array.from(batchMap.entries()).map(([batch, v]) => ({ batch, hostl: v.placedHostl, days: v.placedDays }));

    // Top 5 depts by placement percent
    const topHostlPct = [...deptPctBars].sort((a,b)=>b.hostlPct - a.hostlPct).slice(0,5).map(x=>({ dept: x.dept, value: x.hostlPct }));
    const topDaysPct = [...deptPctBars].sort((a,b)=>b.daysPct - a.daysPct).slice(0,5).map(x=>({ dept: x.dept, value: x.daysPct }));

    // Avg package by type (overall)
    const overallPkg = filteredRows.reduce((acc, r) => {
      const pkg = toNumber(r['Package']);
      const t = String(r['Hosteller/Day Scholar'] || '').toLowerCase();
      if (t.includes('hostel')) acc.hostl.push(pkg); else if (t.includes('day')) acc.days.push(pkg);
      return acc;
    }, { hostl: [] as number[], days: [] as number[] });
    const avg = (a: number[]) => a.length ? Math.round(a.reduce((s,x)=>s+x,0)/a.length) : 0;
    const avgPkgByType = [ { type: 'Hosteller', avg: avg(overallPkg.hostl) }, { type: 'Day Scholar', avg: avg(overallPkg.days) } ];

    // Overall summary gauge
    const overallTotal = totalHostl + totalDays;
    const overallPlaced = placedHostl + placedDays;
    const overallPct = overallTotal ? Math.round((overallPlaced / overallTotal) * 100) : 0;

    // Heatmap like data: dept vs type percentages
    const heatMatrix = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, hostlPct: v.count? Math.round(v.pctHostl/v.count):0, daysPct: v.count? Math.round(v.pctDays/v.count):0 }));

    return { deptStrength, deptPlacedStack, deptPctBars, overallRatio, totalVsPlacedByType, piRatio, batchDist, growthTrend, topHostlPct, topDaysPct, avgPkgByType, avgPkgByDeptType, overallPct, heatMatrix };
  }, [filteredRows]);

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Filtered');
    XLSX.writeFile(wb, 'career_hostel_day_scholar_filtered.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('Career - Hostel/Day Scholar Analysis (Filtered)', 14, 22);
    
    const tableData = filteredRows.map(row => 
      [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS].map(header => row[header] || '')
    );
    
    doc.autoTable({
      head: [[...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS]],
      body: tableData,
      startY: 30,
    });
    
    doc.save('career_hostel_day_scholar_filtered.pdf');
  };

  const resetFilters = () => {
    setSearch('');
    setDept('all');
    setBatch('all');
    setPi('all');
    setIncharge('all');
    setHostelType('all');
    setPlaced('all');
    setPackageMin('');
    setPackageMax('');
    setCurrentPage(1);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Career - Hostel/Day Scholar Analysis</h1>
          <p className="text-muted-foreground">Upload Excel/CSV and analyze hostel vs day scholar</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={downloadTemplate} variant="outline">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Download Template
          </Button>
          <Button onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            Upload Excel
          </Button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.csv"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        className="hidden"
      />

      {rows.length > 0 && (
        <Tabs defaultValue="table" className="space-y-6">
          <TabsList>
            <TabsTrigger value="table">Data Table</TabsTrigger>
            <TabsTrigger value="visualizations">Visualizations</TabsTrigger>
          </TabsList>

          <TabsContent value="table" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  Filters & Search
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="search">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="search"
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dept">Department</Label>
                    <Select value={dept} onValueChange={setDept}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Departments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {departments.map((d) => (
                          <SelectItem key={d} value={String(d)}>{String(d)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="batch">Batch</Label>
                    <Select value={batch} onValueChange={setBatch}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Batches" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Batches</SelectItem>
                        {batches.map((b) => (
                          <SelectItem key={b} value={String(b)}>{String(b)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pi">PI</Label>
                    <Select value={pi} onValueChange={setPi}>
                      <SelectTrigger>
                        <SelectValue placeholder="All PIs" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All PIs</SelectItem>
                        {pis.map((p) => (
                          <SelectItem key={p} value={String(p)}>{String(p)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="incharge">Incharge</Label>
                    <Select value={incharge} onValueChange={setIncharge}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Incharges" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Incharges</SelectItem>
                        {incharges.map((i) => (
                          <SelectItem key={i} value={String(i)}>{String(i)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hostelType">Type</Label>
                    <Select value={hostelType} onValueChange={setHostelType}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="Hosteller">Hosteller</SelectItem>
                        <SelectItem value="Day Scholar">Day Scholar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="placed">Status</Label>
                    <Select value={placed} onValueChange={setPlaced}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="placed">Placed</SelectItem>
                        <SelectItem value="not">Not Placed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="packageMin">Min Package</Label>
                    <Input
                      id="packageMin"
                      type="number"
                      placeholder="Min"
                      value={packageMin}
                      onChange={(e) => setPackageMin(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="packageMax">Max Package</Label>
                    <Input
                      id="packageMax"
                      type="number"
                      placeholder="Max"
                      value={packageMax}
                      onChange={(e) => setPackageMax(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center mt-4">
                  <div className="flex gap-2">
                    <Button onClick={resetFilters} variant="outline" size="sm">
                      Reset Filters
                    </Button>
                    <Button onClick={exportToExcel} variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Export Excel
                    </Button>
                    <Button onClick={exportToPDF} variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Export PDF
                    </Button>
                  </div>
                  <Badge variant="secondary">
                    {filteredRows.length} of {rows.length} records
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Data Table */}
            <Card>
              <CardHeader>
                <CardTitle>Hostel/Day Scholar Analysis Data</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        {[...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS].map((h) => (
                          <th key={h} className="text-left p-2 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows.map((r, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          {[...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS].map((h) => (
                            <td key={h} className="p-2 text-sm">
                              {String(r[h] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="visualizations" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Dept-wise Hostel vs Day Scholar Strength</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={metrics.deptStrength}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="hostl" fill="#3b82f6" />
                    <Bar dataKey="days" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Dept-wise Hostel vs Day Scholar Placed Students</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={metrics.deptPlacedStack}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="hostl" fill="#3b82f6" />
                    <Bar dataKey="days" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Dept-wise Hostel% vs Day Scholar%</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={metrics.deptPctBars}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis domain={[0,100]} />
                    <Tooltip />
                    <Bar dataKey="hostlPct" fill="#3b82f6" />
                    <Bar dataKey="daysPct" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Overall Hostel vs Day Scholar Ratio</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie dataKey="value" data={metrics.overallRatio} cx="50%" cy="50%" outerRadius={100} label>
                      {metrics.overallRatio.map((_, idx) => (<Cell key={idx} fill={COLORS[idx % COLORS.length]} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Total Students vs Placed Students by Type</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.totalVsPlacedByType}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="total" fill="#06b6d4" />
                    <Bar dataKey="placed" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>PI vs Hostel/Day Scholar Ratio</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.piRatio}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="pi" interval={0} angle={-30} textAnchor="end" height={70} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="hostl" fill="#3b82f6" />
                    <Bar dataKey="days" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Batch-wise Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.batchDist}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="batch" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="hostl" fill="#3b82f6" />
                    <Bar dataKey="days" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Growth Trend: Hostel vs Day Scholar</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics.growthTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="batch" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="hostl" stroke="#3b82f6" />
                    <Line type="monotone" dataKey="days" stroke="#ef4444" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Top 5 Departments by Hostel Placement %</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.topHostlPct}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dept" />
                    <YAxis domain={[0,100]} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Top 5 Departments by Day Scholar Placement %</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.topDaysPct}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dept" />
                    <YAxis domain={[0,100]} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Package Trends: Hostel vs Day Scholar (Average)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={metrics.avgPkgByType}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="avg" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Dept-wise Average Package by Type</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={metrics.avgPkgByDeptType}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="hostl" fill="#3b82f6" />
                    <Bar dataKey="days" fill="#ef4444" />
                  </BarChart>
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

            <Card>
              <CardHeader><CardTitle>Heatmap: Dept vs Type Placement %</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.heatMatrix}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis domain={[0,100]} />
                    <Tooltip />
                    <Bar dataKey="hostlPct" fill="#3b82f6" />
                    <Bar dataKey="daysPct" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {rows.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <FileSpreadsheet className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Data Uploaded</h3>
            <p className="text-muted-foreground mb-4">
              Upload an Excel file to start analyzing hostel/day scholar data
            </p>
            <Button onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              Upload Excel File
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CareerHostelDayScholarAnalysis;
