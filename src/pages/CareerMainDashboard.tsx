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
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, AreaChart, Area, ComposedChart } from 'recharts';
import jsPDF from 'jspdf';
import { Search, Filter, Download, Upload, FileSpreadsheet, BarChart3, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type RowData = { [key: string]: any };

const REQUIRED_COLUMNS = [
  'S.No','Reg Number','RollNo','Name','Dept','Section','PI','10th','12th','Diploma','CGPA','CutOff','Training Batch','Gender','Placed or Non Placed','Maximum Salary','Quota','Hosteller / Days scholar','Hosteller/Day Scholar'
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

// Flexible header aliases so small differences don't break uploads
const HEADER_ALIASES: Record<string, string[]> = {
  'S.No': ['s.no', 's no', 'sno', 'serial no', 'serial number', 'sl no'],
  'Reg Number': ['reg number', 'register number', 'registration number', 'regno', 'reg no'],
  'RollNo': ['rollno', 'roll no', 'roll number'],
  'Name': ['name', 'student name'],
  'Dept': ['department', 'dept', 'branch'],
  'Section': ['section', 'sec'],
  'PI': ['pi', 'incharge', 'pi incharge', 'placement incharge'],
  '10th': ['10th', 'sslc', 'class 10', 'x'],
  '12th': ['12th', 'hsc', 'class 12', 'xii'],
  'Diploma': ['diploma'],
  'CGPA': ['cgpa', 'gpa'],
  'CutOff': ['cutoff', 'cut off', 'cut-off'],
  'Training Batch': ['training batch', 'batch', 'year', 'passing year', 'academic year'],
  'Gender': ['gender', 'sex'],
  'Placed or Non Placed': ['placed or non placed', 'placement status', 'status', 'placed/non placed', 'placed - non placed'],
  'Maximum Salary': ['maximum salary', 'max salary', 'package', 'ctc', 'salary'],
  'Quota': ['quota', 'category'],
  'Hosteller / Days scholar': ['hosteller / days scholar', 'hosteller/day scholar', 'hosteller / day scholar', 'hosteller', 'day scholar', 'hostel/day'],
  'Hosteller/Day Scholar': ['hosteller/day scholar', 'hosteller / day scholar', 'hosteller / days scholar']
};

const buildAliasMap = () => {
  const map = new Map<string, string>();
  Object.entries(HEADER_ALIASES).forEach(([canonical, aliases]) => {
    aliases.concat([canonical]).forEach(a => map.set(normalize(a).toLowerCase(), canonical));
  });
  return map;
};

const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#22c55e', '#eab308'];

const CareerMainDashboard: React.FC = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<RowData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // Filters
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState<string>('all');
  const [batch, setBatch] = useState<string>('all');
  const [pi, setPi] = useState<string>('all');
  const [incharge, setIncharge] = useState<string>('all');
  const [placedFilter, setPlacedFilter] = useState<string>('all');
  const [gender, setGender] = useState<string>('all');
  const [quota, setQuota] = useState<string>('all');
  const [hostelType, setHostelType] = useState<string>('all');
  const [company, setCompany] = useState<string>('all');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');

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
        const aliasMap = buildAliasMap();
        data = parsed.map(r => {
          const mapped: RowData = {};
          Object.entries(r).forEach(([k, v]) => {
            const nk = normalize(k).toLowerCase();
            const canonical = aliasMap.get(nk) || normalize(k);
            mapped[canonical] = v;
          });
          return mapped;
        });
        fileHeaders = Object.keys(parsed[0] || {}).map(k => buildAliasMap().get(normalize(k).toLowerCase()) || normalize(k));
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' }) as RowData[];
        const aliasMap = buildAliasMap();
        data = json.map(r => {
          const mapped: RowData = {};
          Object.entries(r).forEach(([k, v]) => {
            const nk = normalize(k).toLowerCase();
            const canonical = aliasMap.get(nk) || normalize(k);
            mapped[canonical] = v;
          });
          return mapped;
        });
        fileHeaders = Object.keys(json[0] || {}).map(k => aliasMap.get(normalize(k).toLowerCase()) || normalize(k));
      }

      // Soft header validation; warn but proceed
      const missing = REQUIRED_COLUMNS.filter(col => !fileHeaders.includes(col));
      if (missing.length) {
        toast({ title: 'Proceeding with partial match', description: `Some columns missing: ${missing.join(', ')}`, variant: 'default' });
      }

      setRows(data);
      setHeaders(Object.keys(data[0] || {}));
      setCurrentPage(1);
      toast({ title: 'Success', description: `Loaded ${data.length} records` });
    } catch (error) {
      console.error('Error processing file:', error);
      toast({ title: 'Error', description: 'Failed to process file', variant: 'destructive' });
    }
  };

  // Filter and search logic
  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      const searchMatch = !search || Object.values(row).some(val => 
        String(val).toLowerCase().includes(search.toLowerCase())
      );
      
      const deptMatch = dept === 'all' || row.Dept === dept;
      const batchMatch = batch === 'all' || row['Training Batch'] === batch;
      const piMatch = pi === 'all' || row.PI === pi;
      const inchargeMatch = incharge === 'all' || row.Incharge === incharge;
      const genderMatch = gender === 'all' || row.Gender === gender;
      const quotaMatch = quota === 'all' || row.Quota === quota;
      const hostelMatch = hostelType === 'all' || row['Hosteller / Days scholar'] === hostelType;
      
      let placedMatch = true;
      if (placedFilter === 'placed') {
        placedMatch = isPlaced(row['Placed or Non Placed']);
      } else if (placedFilter === 'not') {
        placedMatch = !isPlaced(row['Placed or Non Placed']);
      }

      const salaryMatch = (!salaryMin || toNumber(row['Maximum Salary']) >= toNumber(salaryMin)) &&
                         (!salaryMax || toNumber(row['Maximum Salary']) <= toNumber(salaryMax));

      return searchMatch && deptMatch && batchMatch && piMatch && inchargeMatch && 
             genderMatch && quotaMatch && hostelMatch && placedMatch && salaryMatch;
    });
  }, [rows, search, dept, batch, pi, incharge, gender, quota, hostelType, placedFilter, salaryMin, salaryMax]);

  // Get unique values for filters
  const deptOptions = useMemo(() => Array.from(new Set(rows.map(r => r['Dept']).filter(Boolean))) as string[], [rows]);
  const batchOptions = useMemo(() => Array.from(new Set(rows.map(r => r['Training Batch']).filter(Boolean))) as string[], [rows]);
  const piOptions = useMemo(() => Array.from(new Set(rows.map(r => r['PI']).filter(Boolean))) as string[], [rows]);
  const inchargeOptions = useMemo(() => Array.from(new Set(rows.map(r => r['Incharge']).filter(Boolean))) as string[], [rows]);

  // Pagination
  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
  const paginatedRows = filteredRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Metrics for visualizations
  const metrics = useMemo(() => {
    const total = filteredRows.length;
    const placedCount = filteredRows.filter(r => isPlaced(r['Placed or Non Placed'])).length;

    // Dept aggregations
    const deptMap = new Map<string, { total: number; placed: number; highPkg: number; pkgSum: number; pkgCnt: number; multiOffers: number; }>();
    // Gender aggregations
    const genderMap = new Map<string, { total: number; placed: number; pkgSum: number; pkgCnt: number }>();
    // Quota aggregations
    const quotaMap = new Map<string, { placed: number; total: number; pkgSum: number; pkgCnt: number }>();
    // Hostel/Day aggregations
    const hostelMap = new Map<string, { placed: number; total: number; pkgSum: number; pkgCnt: number }>();
    // Company-wise
    const companyMap = new Map<string, { offers: number; pkgSum: number; pkgCnt: number }>();
    // Batch-wise
    const batchMap = new Map<string, { total: number; placed: number; highPkg: number; pkgSum: number; pkgCnt: number }>();

    const salaryKeys = ['Maximum Salary', ...Array.from({ length: 10 }, (_, i) => `Salary (Company ${i+1})`)];
    const companyKeys = ['Company Joined', ...Array.from({ length: 10 }, (_, i) => `Company ${i+1}`)];

    filteredRows.forEach(r => {
      const d = String(r['Dept'] || 'NA');
      const g = String(r['Gender'] || 'NA');
      const q = String(r['Quota'] || 'NA');
      const h = String(r['Hosteller / Days scholar'] || r['Hosteller/Day Scholar'] || 'NA');
      const b = String(r['Training Batch'] || 'NA');
      const placed = isPlaced(r['Placed or Non Placed']);

      const deptRow = deptMap.get(d) || { total: 0, placed: 0, highPkg: 0, pkgSum: 0, pkgCnt: 0, multiOffers: 0 };
      deptRow.total += 1;
      if (placed) deptRow.placed += 1;
      const pkgs = salaryKeys.map(k => toNumber(r[k])).filter(v => Number.isFinite(v) && v > 0);
      if (pkgs.length) {
        deptRow.highPkg = Math.max(deptRow.highPkg, Math.max(...pkgs));
        deptRow.pkgSum += pkgs.reduce((a,b)=>a+b,0);
        deptRow.pkgCnt += pkgs.length;
      }
      const offers = companyKeys.map(k => String(r[k] || '').trim()).filter(Boolean).length;
      if (offers > 1) deptRow.multiOffers += 1;
      deptMap.set(d, deptRow);

      const genderRow = genderMap.get(g) || { total: 0, placed: 0, pkgSum: 0, pkgCnt: 0 };
      genderRow.total += 1; if (placed) genderRow.placed += 1;
      if (pkgs.length) { genderRow.pkgSum += pkgs.reduce((a,b)=>a+b,0); genderRow.pkgCnt += pkgs.length; }
      genderMap.set(g, genderRow);

      const quotaRow = quotaMap.get(q) || { placed: 0, total: 0, pkgSum: 0, pkgCnt: 0 };
      quotaRow.total += 1; if (placed) quotaRow.placed += 1;
      if (pkgs.length) { quotaRow.pkgSum += pkgs.reduce((a,b)=>a+b,0); quotaRow.pkgCnt += pkgs.length; }
      quotaMap.set(q, quotaRow);

      const hostelRow = hostelMap.get(h) || { placed: 0, total: 0, pkgSum: 0, pkgCnt: 0 };
      hostelRow.total += 1; if (placed) hostelRow.placed += 1;
      if (pkgs.length) { hostelRow.pkgSum += pkgs.reduce((a,b)=>a+b,0); hostelRow.pkgCnt += pkgs.length; }
      hostelMap.set(h, hostelRow);

      const batchRow = batchMap.get(b) || { total: 0, placed: 0, highPkg: 0, pkgSum: 0, pkgCnt: 0 };
      batchRow.total += 1; if (placed) batchRow.placed += 1;
      if (pkgs.length) { batchRow.highPkg = Math.max(batchRow.highPkg, Math.max(...pkgs)); batchRow.pkgSum += pkgs.reduce((a,b)=>a+b,0); batchRow.pkgCnt += pkgs.length; }
      batchMap.set(b, batchRow);

      companyKeys.forEach((ck, idx) => {
        const cname = String(r[ck] || '').trim();
        const spkg = toNumber(r[salaryKeys[idx]]);
        if (!cname) return;
        const cRow = companyMap.get(cname) || { offers: 0, pkgSum: 0, pkgCnt: 0 };
        cRow.offers += 1;
        if (Number.isFinite(spkg) && spkg > 0) { cRow.pkgSum += spkg; cRow.pkgCnt += 1; }
        companyMap.set(cname, cRow);
      });
    });

    const overallDonut = [
      { name: 'Placed', value: placedCount },
      { name: 'Not Placed', value: Math.max(total - placedCount, 0) }
    ];

    const deptStrengthVsPlaced = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, total: v.total, placed: v.placed }));
    const genderPlacementRatio = Array.from(genderMap.entries()).map(([gender, v]) => ({ gender, placed: v.placed, total: v.total }));
    const quotaSplit = Array.from(quotaMap.entries()).map(([quota, v]) => ({ quota, placed: v.placed }));
    const hostelVsDay = Array.from(hostelMap.entries()).map(([type, v]) => ({ type, placed: v.placed }));

    const topRecruiters = Array.from(companyMap.entries()).sort((a,b)=>b[1].offers-a[1].offers).slice(0,10).map(([company, v])=>({ company, offers: v.offers }));
    const pkgDistByDept = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, max: v.highPkg }));
    const avgPkgByCompany = Array.from(companyMap.entries()).map(([company, v]) => ({ company, avg: v.pkgCnt ? Math.round(v.pkgSum / v.pkgCnt) : 0 })).slice(0,20);
    const top5DeptsByPct = Array.from(deptMap.entries())
      .map(([dept, v]) => ({ dept, pct: v.total ? Math.round((v.placed / v.total) * 100) : 0 }))
      .sort((a,b)=>b.pct-a.pct)
      .slice(0,5);
    const overallDeptPie = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, value: v.total }));

    const multiCompanyTrend = Array.from(batchMap.entries()).map(([batch, v])=>({ batch, multiOffers: 0, placed: v.placed }));
    const batchPct = Array.from(batchMap.entries()).map(([batch, v]) => ({ batch, pct: v.total ? Math.round((v.placed/v.total)*100) : 0 }));
    const salaryTrend = Array.from(batchMap.entries()).map(([batch, v]) => ({ batch, high: v.highPkg, avg: v.pkgCnt ? Math.round(v.pkgSum / v.pkgCnt) : 0 }));

    const allDeptRadar = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, performance: v.total ? Math.round((v.placed / v.total) * 100) : 0 }));

    return {
      total, placedCount,
      overallDonut,
      deptStrengthVsPlaced,
      genderPlacementRatio,
      quotaSplit,
      hostelVsDay,
      topRecruiters,
      pkgDistByDept,
      avgPkgByCompany,
      top5DeptsByPct,
      overallDeptPie,
      multiCompanyTrend,
      batchPct,
      salaryTrend,
      allDeptRadar
    };
  }, [filteredRows]);

  // Export functions
  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Main Dashboard');
    XLSX.writeFile(wb, 'main_dashboard_export.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('Career Main Dashboard Report', 20, 20);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30);
    doc.text(`Total Records: ${filteredRows.length}`, 20, 40);
    doc.save('main_dashboard_report.pdf');
  };

  const resetFilters = () => {
    setSearch('');
    setDept('all');
    setBatch('all');
    setPi('all');
    setIncharge('all');
    setPlacedFilter('all');
    setGender('all');
    setQuota('all');
    setHostelType('all');
    setCompany('all');
    setSalaryMin('');
    setSalaryMax('');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Career - Main Dashboard</h1>
          <p className="text-muted-foreground">Unified dashboard across students, companies, quota, gender and more</p>
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
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
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
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="search"
                        placeholder="Search all fields..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                      />
            </div>
          </div>
                  
          <div className="space-y-2">
                    <Label>Department</Label>
            <Select value={dept} onValueChange={setDept}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Departments" />
                      </SelectTrigger>
              <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {deptOptions.map(dept => (
                          <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                        ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
                    <Label>Batch</Label>
            <Select value={batch} onValueChange={setBatch}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Batches" />
                      </SelectTrigger>
              <SelectContent>
                        <SelectItem value="all">All Batches</SelectItem>
                        {batchOptions.map(batch => (
                          <SelectItem key={batch} value={batch}>{batch}</SelectItem>
                        ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
                    <Label>PI</Label>
            <Select value={pi} onValueChange={setPi}>
                      <SelectTrigger>
                        <SelectValue placeholder="All PIs" />
                      </SelectTrigger>
              <SelectContent>
                        <SelectItem value="all">All PIs</SelectItem>
                        {piOptions.map(pi => (
                          <SelectItem key={pi} value={pi}>{pi}</SelectItem>
                        ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
                    <Label>Status</Label>
            <Select value={placedFilter} onValueChange={setPlacedFilter}>
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
                    <Label>Salary Range</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Min"
                        value={salaryMin}
                        onChange={(e) => setSalaryMin(e.target.value)}
                        type="number"
                      />
                      <Input
                        placeholder="Max"
                        value={salaryMax}
                        onChange={(e) => setSalaryMax(e.target.value)}
                        type="number"
                      />
          </div>
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
                <CardTitle>Main Dashboard Data</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">S.No</th>
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Reg Number</th>
                        <th className="text-left p-2">Dept</th>
                        <th className="text-left p-2">Batch</th>
                        <th className="text-left p-2">PI</th>
                        <th className="text-left p-2">Gender</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Max Salary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows.map((row, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="p-2">{row['S.No']}</td>
                          <td className="p-2">{row.Name}</td>
                          <td className="p-2">{row['Reg Number']}</td>
                          <td className="p-2">{row.Dept}</td>
                          <td className="p-2">{row['Training Batch']}</td>
                          <td className="p-2">{row.PI}</td>
                          <td className="p-2">{row.Gender}</td>
                          <td className="p-2">{row['Placed or Non Placed']}</td>
                          <td className="p-2">{row['Maximum Salary']}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredRows.length)} of {filteredRows.length} entries
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="px-3 py-1 text-sm">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Overall Placement Percentage (Donut) */}
              <Card>
                <CardHeader><CardTitle>Overall Placement Percentage</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie dataKey="value" data={metrics.overallDonut} cx="50%" cy="50%" innerRadius={60} outerRadius={100} label>
                        {metrics.overallDonut.map((_, idx) => (<Cell key={idx} fill={COLORS[idx % COLORS.length]} />))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Dept-wise Student Strength vs Placed (Stacked Bar) */}
              <Card>
                <CardHeader><CardTitle>Dept-wise Strength vs Placed</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={metrics.deptStrengthVsPlaced}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="dept" interval={0} angle={-25} textAnchor="end" height={60} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="total" stackId="a" fill="#3b82f6" />
                      <Bar dataKey="placed" stackId="a" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Gender-wise Placement Ratio */}
              <Card>
                <CardHeader><CardTitle>Gender-wise Placement Ratio</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={metrics.genderPlacementRatio}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="gender" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="total" fill="#94a3b8" />
                      <Bar dataKey="placed" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Quota-wise Placement Split */}
              <Card>
                <CardHeader><CardTitle>Quota-wise Placement Split</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie dataKey="placed" data={metrics.quotaSplit} cx="50%" cy="50%" outerRadius={100} label>
                        {metrics.quotaSplit.map((_, idx) => (<Cell key={idx} fill={COLORS[idx % COLORS.length]} />))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Hostel vs Day Scholar Placement Comparison */}
              <Card>
                <CardHeader><CardTitle>Hostel vs Day Scholar Placement</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={metrics.hostelVsDay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="placed" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Company-wise Top Recruiters */}
              <Card>
                <CardHeader><CardTitle>Top Recruiters</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={metrics.topRecruiters} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="company" width={120} />
                      <Tooltip />
                      <Bar dataKey="offers" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Package Distribution by Dept (max shown as proxy) */}
              <Card>
                <CardHeader><CardTitle>Highest Package by Dept</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={metrics.pkgDistByDept}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="dept" interval={0} angle={-25} textAnchor="end" height={60} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="max" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Average Package by Company */}
              <Card>
                <CardHeader><CardTitle>Average Package by Company</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={metrics.avgPkgByCompany}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="company" interval={0} angle={-25} textAnchor="end" height={60} />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="avg" stroke="#3b82f6" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Top 5 Depts with Highest Placement % */}
              <Card>
                <CardHeader><CardTitle>Top 5 Depts by Placement %</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={metrics.top5DeptsByPct}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="dept" />
                      <YAxis domain={[0,100]} />
                      <Tooltip />
                      <Bar dataKey="pct" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Overall Student Distribution by Dept (Pie) */}
              <Card>
                <CardHeader><CardTitle>Student Distribution by Dept</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie dataKey="value" data={metrics.overallDeptPie} cx="50%" cy="50%" outerRadius={100} label>
                        {metrics.overallDeptPie.map((_, idx) => (<Cell key={idx} fill={COLORS[idx % COLORS.length]} />))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Multi-Company Offer Trend (Bar + Line) */}
              <Card>
                <CardHeader><CardTitle>Multi-Offer & Placement Trend</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={metrics.multiCompanyTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="batch" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="multiOffers" fill="#8b5cf6" />
                      <Line type="monotone" dataKey="placed" stroke="#10b981" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Training Batch vs Placement % */}
              <Card>
                <CardHeader><CardTitle>Training Batch vs Placement %</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={metrics.batchPct}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="batch" />
                      <YAxis domain={[0,100]} />
                      <Tooltip />
                      <Line type="monotone" dataKey="pct" stroke="#ef4444" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* High Salary vs Average Salary Trend */}
              <Card>
                <CardHeader><CardTitle>High vs Average Salary Trend</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={metrics.salaryTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="batch" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="high" stroke="#ef4444" />
                      <Line type="monotone" dataKey="avg" stroke="#3b82f6" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Placed vs Non-Placed Students (Donut) */}
              <Card>
                <CardHeader><CardTitle>Placed vs Non-Placed</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie dataKey="value" data={metrics.overallDonut} cx="50%" cy="50%" innerRadius={60} outerRadius={100} label>
                        {metrics.overallDonut.map((_, idx) => (<Cell key={idx} fill={COLORS[idx % COLORS.length]} />))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* All Dept Performance (Radar) */}
              <Card>
                <CardHeader><CardTitle>All Dept Performance</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <RadarChart data={metrics.allDeptRadar}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="dept" />
                      <PolarRadiusAxis />
                      <Radar name="Performance" dataKey="performance" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.4} />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {rows.length === 0 && (
        <Card className="text-center py-12">
            <CardContent>
            <FileSpreadsheet className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Data Uploaded</h3>
            <p className="text-muted-foreground mb-4">
              Upload an Excel file to start analyzing career data
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

export default CareerMainDashboard;
