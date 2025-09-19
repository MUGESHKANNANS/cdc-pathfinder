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
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis } from 'recharts';
import jsPDF from 'jspdf';
import { Search, Filter, Download, Upload, FileSpreadsheet, BarChart3, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type RowData = { [key: string]: any };

const REQUIRED_COLUMNS = [
  'S.No', 'Dept', 'PI', 'Batch', 'Incharge', 'Total', 'No Of Student Placed', 'Balance', 'Percentage', 'Not in Batch', 'Package'
];

const TEMPLATE_HEADERS = REQUIRED_COLUMNS;

const normalize = (s: string) => s?.trim().replace(/\s+/g, ' ').replace(/\u00A0/g, ' ');
const toNumber = (v: any): number => {
  const n = Number(String(v).toString().replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#22c55e', '#eab308'];

const CareerAllAnalysis: React.FC = () => {
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
  const [placed, setPlaced] = useState<string>('all'); // all | placed | not
  const [packageMin, setPackageMin] = useState('');
  const [packageMax, setPackageMax] = useState('');

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
    XLSX.writeFile(wb, 'career_all_analysis_template.xlsx');
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
          const mapped: RowData = {};
          Object.entries(r).forEach(([k, v]) => { mapped[normalize(k)] = v; });
          return mapped;
        });
        fileHeaders = Object.keys(parsed[0] || {}).map(normalize);
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' }) as RowData[];
        data = json.map(r => {
          const mapped: RowData = {};
          Object.entries(r).forEach(([k, v]) => { mapped[normalize(k)] = v; });
          return mapped;
        });
        fileHeaders = Object.keys(json[0] || {}).map(normalize);
      }

      const missing = REQUIRED_COLUMNS.filter(col => !fileHeaders.includes(col));
      if (missing.length) {
        toast({ title: 'Validation failed', description: `Missing columns: ${missing.join(', ')}`, variant: 'destructive' });
        return;
      }

      setHeaders(fileHeaders);
      setRows(data);
      setCurrentPage(1);
      toast({ title: 'Success', description: `Loaded ${data.length} records` });
    } catch (e: any) {
      toast({ title: 'Parse error', description: e.message || 'Failed to parse file', variant: 'destructive' });
    }
  };

  // Enhanced filtering logic
  const filteredRows = useMemo(() => {
    const placedKey = 'No Of Student Placed';
    const searchLower = search.toLowerCase();
    return rows.filter(r => {
      const matchesSearch = search ? Object.values(r).some(v => String(v).toLowerCase().includes(searchLower)) : true;
      const matchesDept = dept === 'all' ? true : String(r['Dept']) === dept;
      const matchesBatch = batch === 'all' ? true : String(r['Batch']) === batch;
      const matchesPi = pi === 'all' ? true : String(r['PI']) === pi;
      const matchesIncharge = incharge === 'all' ? true : String(r['Incharge']) === incharge;
      const isPlaced = toNumber(r[placedKey]) > 0;
      const matchesPlaced = placed === 'all' ? true : placed === 'placed' ? isPlaced : !isPlaced;
      const packageMatch = (!packageMin || toNumber(r['Package']) >= toNumber(packageMin)) &&
                         (!packageMax || toNumber(r['Package']) <= toNumber(packageMax));
      return matchesSearch && matchesDept && matchesBatch && matchesPi && matchesIncharge && matchesPlaced && packageMatch;
    });
  }, [rows, search, dept, batch, pi, incharge, placed, packageMin, packageMax]);

  // Pagination
  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
  const paginatedRows = filteredRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Export functions
  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'All Analysis');
    XLSX.writeFile(wb, 'all_analysis_export.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('Career All Analysis Report', 20, 20);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30);
    doc.text(`Total Records: ${filteredRows.length}`, 20, 40);
    doc.save('all_analysis_report.pdf');
  };

  const resetFilters = () => {
    setSearch('');
    setDept('all');
    setBatch('all');
    setPi('all');
    setIncharge('all');
    setPlaced('all');
    setPackageMin('');
    setPackageMax('');
  };

  // Use filteredRows for metrics

  const departments = useMemo(() => Array.from(new Set(rows.map(r => r['Dept']).filter(Boolean))) as string[], [rows]);
  const batches = useMemo(() => Array.from(new Set(rows.map(r => r['Batch']).filter(Boolean))) as string[], [rows]);
  const pis = useMemo(() => Array.from(new Set(rows.map(r => r['PI']).filter(Boolean))) as string[], [rows]);
  const incharges = useMemo(() => Array.from(new Set(rows.map(r => r['Incharge']).filter(Boolean))) as string[], [rows]);

  // Aggregations for charts
  const metrics = useMemo(() => {
    const totalPlaced = filteredRows.reduce((s, r) => s + toNumber(r['No Of Student Placed']), 0);
    const totalNotInBatch = filteredRows.reduce((s, r) => s + toNumber(r['Not in Batch']), 0);
    const totalStudents = filteredRows.reduce((s, r) => s + toNumber(r['Total']), 0);
    const totalBalance = filteredRows.reduce((s, r) => s + toNumber(r['Balance']), 0);

    // Dept groups
    const deptMap = new Map<string, { total: number; placed: number; balance: number; pkg: number[]; percentSum: number; count: number }>();
    filteredRows.forEach(r => {
      const d = String(r['Dept'] || 'NA');
      const row = deptMap.get(d) || { total: 0, placed: 0, balance: 0, pkg: [], percentSum: 0, count: 0 };
      row.total += toNumber(r['Total']);
      row.placed += toNumber(r['No Of Student Placed']);
      row.balance += toNumber(r['Balance']);
      const pkgVal = toNumber(r['Package']); if (Number.isFinite(pkgVal)) row.pkg.push(pkgVal);
      row.percentSum += toNumber(r['Percentage']);
      row.count += 1;
      deptMap.set(d, row);
    });

    const deptTotals = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, total: v.total }));
    const deptPlaced = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, placed: v.placed }));
    const deptPercentage = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, percentage: v.count ? Math.round(v.percentSum / v.count) : 0 }));
    const avgPackageByDept = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, avg: v.pkg.length ? Math.round(v.pkg.reduce((a,b)=>a+b,0)/v.pkg.length) : 0 }));

    // For scatter (dept vs package)
    const deptPackagePoints: { dept: string; x: number; y: number }[] = [];
    filteredRows.forEach(r => { deptPackagePoints.push({ dept: String(r['Dept'] || 'NA'), x: Math.max(0, deptPackagePoints.length+1), y: toNumber(r['Package']) }); });

    // Top 5 packages overall
    const top5Packages = [...filteredRows]
      .map(r => ({ dept: String(r['Dept'] || 'NA'), pkg: toNumber(r['Package']) }))
      .sort((a,b)=>b.pkg-a.pkg)
      .slice(0,5)
      .map((x, idx) => ({ rank: `#${idx+1}`, dept: x.dept, pkg: x.pkg }));

    // Batch aggregations
    const batchMap = new Map<string, { total: number; placed: number; percentSum: number; count: number }>();
    filteredRows.forEach(r => {
      const b = String(r['Batch'] || 'NA');
      const row = batchMap.get(b) || { total: 0, placed: 0, percentSum: 0, count: 0 };
      row.total += toNumber(r['Total']);
      row.placed += toNumber(r['No Of Student Placed']);
      row.percentSum += toNumber(r['Percentage']);
      row.count += 1;
      batchMap.set(b, row);
    });
    const batchStrength = Array.from(batchMap.entries()).map(([batch, v]) => ({ batch, value: v.total }));
    const batchStacked = Array.from(batchMap.entries()).map(([batch, v]) => ({ batch, total: v.total, placed: v.placed }));
    const batchPercentTrend = Array.from(batchMap.entries()).map(([batch, v]) => ({ batch, percentage: v.count ? Math.round(v.percentSum / v.count) : 0 }));

    // Incharge vs placement count
    const inchargeMap = new Map<string, number>();
    filteredRows.forEach(r => { const inc = String(r['Incharge'] || 'NA'); inchargeMap.set(inc, (inchargeMap.get(inc)||0) + toNumber(r['No Of Student Placed'])); });
    const inchargePlacement = Array.from(inchargeMap.entries()).map(([incharge, value]) => ({ incharge, value }));

    // PI trend
    const piMap = new Map<string, { percentSum: number; count: number }>();
    filteredRows.forEach(r => { const p = String(r['PI'] || 'NA'); const cur = piMap.get(p) || { percentSum: 0, count: 0 }; cur.percentSum += toNumber(r['Percentage']); cur.count++; piMap.set(p, cur); });
    const piTrend = Array.from(piMap.entries()).map(([pi, v]) => ({ pi, percentage: v.count ? Math.round(v.percentSum / v.count) : 0 }));

    // Batch growth multiline (totals and placed)
    const batchGrowth = Array.from(batchMap.entries()).map(([batch, v]) => ({ batch, total: v.total, placed: v.placed }));

    return {
      totalPlaced, totalNotInBatch, totalStudents, totalBalance,
      deptTotals, deptPlaced, deptPercentage, avgPackageByDept, deptPackagePoints, top5Packages,
      batchStrength, batchStacked, batchPercentTrend,
      inchargePlacement, piTrend, batchGrowth
    };
  }, [filteredRows]);

  const exportFilteredToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filtered);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Filtered');
    XLSX.writeFile(wb, 'career_all_analysis_filtered.xlsx');
  };

  const exportFilteredToPdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 40; let y = margin;
    doc.setFontSize(14); doc.text('Career - All Analysis (Filtered)', margin, y); y += 20;
    doc.setFontSize(9);
    const cols = REQUIRED_COLUMNS;
    // header
    let x = margin;
    cols.forEach(h => { doc.text(String(h), x, y); x += 80; }); y += 14;
    doc.setLineWidth(0.5); doc.line(margin, y, 555, y); y += 8;
    // rows (cap for pdf size)
    filtered.slice(0, 60).forEach(r => {
      let cx = margin;
      cols.forEach(h => { const txt = String(r[h] ?? ''); doc.text(txt.length > 14 ? txt.slice(0, 14) + '…' : txt, cx, y); cx += 80; });
      y += 14;
      if (y > 780) { doc.addPage(); y = margin; }
    });
    doc.save('career_all_analysis_filtered.pdf');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Career - All Analysis</h1>
          <p className="text-muted-foreground">Upload Excel/CSV, view table, filters, and analytics</p>
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
                        {departments.map(dept => (
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
                        {batches.map(batch => (
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
                        {pis.map(pi => (
                          <SelectItem key={pi} value={pi}>{pi}</SelectItem>
                        ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Incharge</Label>
            <Select value={incharge} onValueChange={setIncharge}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Incharges" />
                      </SelectTrigger>
              <SelectContent>
                        <SelectItem value="all">All Incharges</SelectItem>
                        {incharges.map(incharge => (
                          <SelectItem key={incharge} value={incharge}>{incharge}</SelectItem>
                        ))}
              </SelectContent>
            </Select>
          </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
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
                    <Label>Package Range</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Min"
                        value={packageMin}
                        onChange={(e) => setPackageMin(e.target.value)}
                        type="number"
                      />
                      <Input
                        placeholder="Max"
                        value={packageMax}
                        onChange={(e) => setPackageMax(e.target.value)}
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
                <CardTitle>All Analysis Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                <thead>
                      <tr className="border-b">
                    {REQUIRED_COLUMNS.map(h => (
                          <th key={h} className="text-left p-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                      {paginatedRows.map((row, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                      {REQUIRED_COLUMNS.map(h => (
                            <td key={h} className="p-2">{String(row[h] ?? '')}</td>
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
            {/* All existing visualizations */}
          <Card>
            <CardHeader><CardTitle>Dept-wise Totals and Placed</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="col-span-1">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.deptTotals}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="total" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
                <p className="mt-2 text-xs text-muted-foreground text-center">Dept-wise Total Students</p>
              </div>
              <div className="col-span-1">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.deptPlaced}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="placed" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
                <p className="mt-2 text-xs text-muted-foreground text-center">Dept-wise Students Placed</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Dept-wise Placement Percentage</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={metrics.deptPercentage} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis type="category" dataKey="dept" width={100} />
                  <Tooltip />
                  <Bar dataKey="percentage" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Batch-wise Strength and Placement</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="col-span-1">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie dataKey="value" data={metrics.batchStrength} cx="50%" cy="50%" outerRadius={90} label>
                      {metrics.batchStrength.map((_, idx) => (<Cell key={`b-${idx}`} fill={COLORS[idx % COLORS.length]} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <p className="mt-2 text-xs text-muted-foreground text-center">Batch-wise Student Strength</p>
              </div>
              <div className="col-span-1">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.batchStacked}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="batch" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="total" stackId="a" fill="#3b82f6" />
                    <Bar dataKey="placed" stackId="a" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
                <p className="mt-2 text-xs text-muted-foreground text-center">Batch vs Placement Count</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Incharge vs Placement Count</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.inchargePlacement}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="incharge" interval={0} angle={-30} textAnchor="end" height={70} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Placement Percentage Across Batches</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={metrics.batchPercentTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="batch" />
                  <YAxis domain={[0,100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="percentage" stroke="#8b5cf6" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Placed vs Not in Batch</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie dataKey="value" data={[{ name: 'Placed', value: metrics.totalPlaced }, { name: 'Not in Batch', value: metrics.totalNotInBatch }]} cx="50%" cy="50%" innerRadius={50} outerRadius={90} label>
                    {[0,1].map((_, idx) => (<Cell key={`p-${idx}`} fill={COLORS[idx % COLORS.length]} />))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Total vs Balance Students (Overall)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={[{ name: 'Students', total: metrics.totalStudents, balance: metrics.totalBalance }] }>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill="#3b82f6" />
                  <Bar dataKey="balance" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Dept-wise Package Distribution (Scatter)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart>
                  <CartesianGrid />
                  <XAxis type="number" dataKey="x" name="#" />
                  <YAxis type="number" dataKey="y" name="Package" />
                  <ZAxis range={[60, 60]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter data={metrics.deptPackagePoints} fill="#06b6d4" />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Average Package by Dept</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={metrics.avgPackageByDept}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avg" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Top 5 High Packages</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={metrics.top5Packages}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="rank" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="pkg" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-2 text-xs text-muted-foreground text-center">Bars annotated by rank; hover to see dept</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Placement Percentage Trend by PI</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={metrics.piTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="pi" interval={0} angle={-30} textAnchor="end" height={70} />
                  <YAxis domain={[0,100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="percentage" stroke="#3b82f6" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Overall Placement Summary</CardTitle></CardHeader>
            <CardContent>
              {(() => {
                const percentPlaced = metrics.totalStudents ? Math.round((metrics.totalPlaced / metrics.totalStudents) * 100) : 0;
                return (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie dataKey="value" data={[{ name: 'Placed %', value: percentPlaced }, { name: 'Remaining', value: 100 - percentPlaced }]} cx="50%" cy="50%" innerRadius={60} outerRadius={100}>
                        {[0,1].map((_, idx) => (<Cell key={`g-${idx}`} fill={idx===0 ? '#10b981' : '#e5e7eb'} />))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                );
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Batch-wise Career Growth</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={metrics.batchGrowth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="batch" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="#3b82f6" />
                  <Line type="monotone" dataKey="placed" stroke="#10b981" />
                </LineChart>
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

export default CareerAllAnalysis;


