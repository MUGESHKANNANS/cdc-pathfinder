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
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis } from 'recharts';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Search, Filter, Download, Upload, FileSpreadsheet, BarChart3, TrendingUp } from 'lucide-react';

type RowData = { [key: string]: any };

const REQUIRED_COLUMNS = [
  'S.No', 'Dept', 'Total', 'PI', 'No Of Student Placed', 'Balance', 'Batch', 'OverAll Percentage', 'Package'
];

const TEMPLATE_HEADERS = REQUIRED_COLUMNS;

const normalize = (s: string) => s?.trim().replace(/\s+/g, ' ').replace(/\u00A0/g, ' ');
const toNumber = (v: any): number => {
  const n = Number(String(v).toString().replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// Allow flexible header names from user files
const HEADER_ALIASES: Record<string, string[]> = {
  'S.No': ['s.no', 's no', 'sno', 'serial no', 'serial number', 'sl no'],
  'Dept': ['department', 'dept', 'branch'],
  'Total': ['total', 'total students', 'strength'],
  'PI': ['pi', 'incharge', 'pi incharge', 'placement incharge'],
  'No Of Student Placed': ['no of student placed', 'no of students placed', 'students placed', 'placed', 'placed count'],
  'Balance': ['balance', 'remaining', 'not placed', 'unplaced'],
  'Batch': ['batch', 'year', 'academic year', 'passing year'],
  'OverAll Percentage': ['overall percentage', 'placement percentage', 'overall %', 'percentage'],
  'Package': ['package', 'ctc', 'salary', 'offer package']
};

const buildAliasMap = () => {
  const map = new Map<string, string>();
  Object.entries(HEADER_ALIASES).forEach(([canonical, aliases]) => {
    aliases.concat([canonical]).forEach(a => map.set(normalize(a).toLowerCase(), canonical));
  });
  return map;
};

const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#22c55e', '#eab308'];

const CareerPlacementOffer: React.FC = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<RowData[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState<string>('all');
  const [batch, setBatch] = useState<string>('all');
  const [pi, setPi] = useState<string>('all');
  const [placed, setPlaced] = useState<string>('all'); // all | placed | not
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
    XLSX.writeFile(wb, 'career_placement_offer_template.xlsx');
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
        fileHeaders = Object.keys(parsed[0] || {}).map(k => aliasMap.get(normalize(k).toLowerCase()) || normalize(k));
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

      // Soft header validation: warn but continue if some columns are missing
      const normalizedRequired = REQUIRED_COLUMNS.map(normalize);
      const missing = normalizedRequired.filter(col => !fileHeaders.includes(col));
      if (missing.length) {
        toast({ title: 'Proceeding with partial match', description: `Some columns missing: ${missing.join(', ')}`, variant: 'default' });
      }

      setRows(data);
      setCurrentPage(1);
      console.log('Data loaded:', data.length, 'records');
      console.log('Sample record:', data[0]);
      toast({ title: 'Upload successful', description: `${data.length} records loaded` });
    } catch (e: any) {
      toast({ title: 'Parse error', description: e.message || 'Failed to parse file', variant: 'destructive' });
    }
  };

  const filteredRows = useMemo(() => {
    const placedKey = 'No Of Student Placed';
    const searchLower = search.toLowerCase();
    const filtered = rows.filter(r => {
      const matchesSearch = search ? Object.values(r).some(v => String(v).toLowerCase().includes(searchLower)) : true;
      const matchesDept = dept === 'all' ? true : String(r['Dept']) === dept;
      const matchesBatch = batch === 'all' ? true : String(r['Batch']) === batch;
      const matchesPi = pi === 'all' ? true : String(r['PI']) === pi;
      const isPlaced = toNumber(r[placedKey]) > 0;
      const matchesPlaced = placed === 'all' ? true : placed === 'placed' ? isPlaced : !isPlaced;
      
      const packageValue = toNumber(r['Package']);
      const matchesPackageMin = !packageMin || packageValue >= toNumber(packageMin);
      const matchesPackageMax = !packageMax || packageValue <= toNumber(packageMax);
      
      return matchesSearch && matchesDept && matchesBatch && matchesPi && matchesPlaced && matchesPackageMin && matchesPackageMax;
    });
    console.log('Filtering results:', { totalRows: rows.length, filteredRows: filtered.length, search, dept, batch, pi, placed, packageMin, packageMax });
    return filtered;
  }, [rows, search, dept, batch, pi, placed, packageMin, packageMax]);

  const departments = useMemo(() => Array.from(new Set(rows.map(r => r['Dept']).filter(Boolean))) as string[], [rows]);
  const batches = useMemo(() => Array.from(new Set(rows.map(r => r['Batch']).filter(Boolean))) as string[], [rows]);
  const pis = useMemo(() => Array.from(new Set(rows.map(r => r['PI']).filter(Boolean))) as string[], [rows]);

  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Aggregations for charts
  const metrics = useMemo(() => {
    const totalPlaced = filteredRows.reduce((s, r) => s + toNumber(r['No Of Student Placed']), 0);
    const totalStudents = filteredRows.reduce((s, r) => s + toNumber(r['Total']), 0);
    const totalBalance = filteredRows.reduce((s, r) => s + toNumber(r['Balance']), 0);

    // Dept groups
    const deptMap = new Map<string, { total: number; placed: number; balance: number; percentSum: number; count: number; pkg: number[] }>();
    filteredRows.forEach(r => {
      const d = String(r['Dept'] || 'NA');
      const row = deptMap.get(d) || { total: 0, placed: 0, balance: 0, percentSum: 0, count: 0, pkg: [] };
      row.total += toNumber(r['Total']);
      row.placed += toNumber(r['No Of Student Placed']);
      row.balance += toNumber(r['Balance']);
      row.percentSum += toNumber(r['OverAll Percentage']);
      const pkgVal = toNumber(r['Package']); if (Number.isFinite(pkgVal)) row.pkg.push(pkgVal);
      row.count += 1;
      deptMap.set(d, row);
    });

    const deptTotals = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, total: v.total }));
    const deptPlaced = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, placed: v.placed }));
    const deptPercentage = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, percentage: v.count ? Math.round(v.percentSum / v.count) : 0 }));
    const deptOverallPercent = deptPercentage; // alias
    const deptBalanceStack = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, placed: v.placed, balance: v.balance }));
    const avgPackageByDept = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, avgPackage: v.pkg.length ? Math.round(v.pkg.reduce((a,b)=>a+b,0)/v.pkg.length) : 0 }));

    // Highest package by dept
    const deptTopPackages = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, maxPackage: v.pkg.length ? Math.max(...v.pkg) : 0 }));

    // Top 5 overall packages (optional dataset used elsewhere)
    const top5Packages = [...filteredRows]
      .map(r => ({ dept: String(r['Dept'] || 'NA'), pkg: toNumber(r['Package']) }))
      .sort((a,b)=>b.pkg-a.pkg)
      .slice(0,5)
      .map((x, idx) => ({ rank: `#${idx+1}`, dept: x.dept, pkg: x.pkg }));

    // Batch aggregations
    const batchMap = new Map<string, { total: number; placed: number; percentSum: number; count: number; pkgSum: number; pkgCount: number }>();
    filteredRows.forEach(r => {
      const b = String(r['Batch'] || 'NA');
      const row = batchMap.get(b) || { total: 0, placed: 0, percentSum: 0, count: 0, pkgSum: 0, pkgCount: 0 };
      row.total += toNumber(r['Total']);
      row.placed += toNumber(r['No Of Student Placed']);
      row.percentSum += toNumber(r['OverAll Percentage']);
      const pkgVal = toNumber(r['Package']); if (Number.isFinite(pkgVal)) { row.pkgSum += pkgVal; row.pkgCount++; }
      row.count += 1;
      batchMap.set(b, row);
    });
    const batchStrength = Array.from(batchMap.entries()).map(([batch, v]) => ({ batch, value: v.total }));
    const batchStacked = Array.from(batchMap.entries()).map(([batch, v]) => ({ batch, total: v.total, placed: v.placed }));
    const batchPercentTrend = Array.from(batchMap.entries()).map(([batch, v]) => ({ batch, percentage: v.count ? Math.round(v.percentSum / v.count) : 0 }));
    const batchAvgPackageTrend = Array.from(batchMap.entries()).map(([batch, v]) => ({ batch, avgPackage: v.pkgCount ? Math.round(v.pkgSum / v.pkgCount) : 0 }));

    // PI-wise placement performance
    const piPlacedMap = new Map<string, number>();
    const piTotalMap = new Map<string, number>();
    filteredRows.forEach(r => {
      const p = String(r['PI'] || 'NA');
      piPlacedMap.set(p, (piPlacedMap.get(p)||0) + toNumber(r['No Of Student Placed']));
      piTotalMap.set(p, (piTotalMap.get(p)||0) + toNumber(r['Total']));
    });
    const piPlacement = Array.from(piPlacedMap.entries()).map(([pi, placed]) => ({ pi, placed }));
    const piPercentage = Array.from(piPlacedMap.entries()).map(([pi, placed]) => ({ pi, percentage: (piTotalMap.get(pi)||0) ? Math.round((placed/(piTotalMap.get(pi)||1))*100) : 0 }));

    // Placed vs Not Placed
    const placedNotPlaced = [
      { name: 'Placed', value: totalPlaced },
      { name: 'Not Placed', value: Math.max(totalStudents - totalPlaced, 0) }
    ];

    // Dept vs Package scatter (y as package, x as dept index + 1)
    const deptOrder = Array.from(deptMap.keys());
    const deptVsPackage = filteredRows.map(r => ({
      dept: String(r['Dept'] || 'NA'),
      x: Math.max(1, deptOrder.indexOf(String(r['Dept'] || 'NA')) + 1),
      package: toNumber(r['Package'])
    }));

    return {
      totalPlaced, totalStudents, totalBalance,
      deptTotals, deptPlaced, deptPercentage, deptOverallPercent, deptBalanceStack,
      avgPackageByDept, deptTopPackages, top5Packages,
      batchStrength, batchStacked, batchPercentTrend, batchAvgPackageTrend,
      piPlacement, piPercentage, placedNotPlaced, deptVsPackage
    };
  }, [filteredRows]);

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Filtered');
    XLSX.writeFile(wb, 'career_placement_offer_filtered.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('Career - Placement Offer (Filtered)', 14, 22);
    
    const tableData = filteredRows.map(row => 
      REQUIRED_COLUMNS.map(header => row[header] || '')
    );
    
    doc.autoTable({
      head: [REQUIRED_COLUMNS],
      body: tableData,
      startY: 30,
    });
    
    doc.save('career_placement_offer_filtered.pdf');
  };

  const resetFilters = () => {
    setSearch('');
    setDept('all');
    setBatch('all');
    setPi('all');
    setPlaced('all');
    setPackageMin('');
    setPackageMax('');
    setCurrentPage(1);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Career - Placement Offer</h1>
          <p className="text-muted-foreground">Upload Excel/CSV and analyze placement offers</p>
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
                <CardTitle>Placement Offer Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                <thead>
                      <tr className="border-b">
                        {REQUIRED_COLUMNS.map((h) => (
                          <th key={h} className="text-left p-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                      {paginatedRows.map((r, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          {REQUIRED_COLUMNS.map((h) => (
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
                <BarChart data={metrics.piPlacement}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="pi" interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="placed" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-2 text-xs text-muted-foreground text-center">Placement count by Incharge</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Placement Percentage Across Batches</CardTitle></CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metrics.batchPercentTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="batch" />
                    <YAxis domain={[0, 100]} />
                  <Tooltip />
                    <Line type="monotone" dataKey="percentage" stroke="#ef4444" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
                <p className="mt-2 text-xs text-muted-foreground text-center">Placement percentage trend across batches</p>
            </CardContent>
          </Card>

          <Card>
              <CardHeader><CardTitle>Placed vs Not Placed (Donut)</CardTitle></CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                    <Pie dataKey="value" data={metrics.placedNotPlaced} cx="50%" cy="50%" innerRadius={60} outerRadius={100} label>
                      {metrics.placedNotPlaced.map((_, idx) => (<Cell key={`p-${idx}`} fill={COLORS[idx % COLORS.length]} />))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
                <p className="mt-2 text-xs text-muted-foreground text-center">Overall placement distribution</p>
            </CardContent>
          </Card>

          <Card>
              <CardHeader><CardTitle>Total Students vs Balance Students</CardTitle></CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.deptBalanceStack}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis />
                  <Tooltip />
                    <Bar dataKey="placed" stackId="a" fill="#10b981" />
                    <Bar dataKey="balance" stackId="a" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
                <p className="mt-2 text-xs text-muted-foreground text-center">Placed vs Balance by Department</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Dept-wise Package Distribution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart>
                  <CartesianGrid />
                  <XAxis dataKey="x" />
                  <YAxis dataKey="package" />
                  <Tooltip />
                  <Scatter data={metrics.deptVsPackage} fill="#06b6d4" />
                </ScatterChart>
              </ResponsiveContainer>
              <p className="mt-2 text-xs text-muted-foreground text-center">Package distribution by department</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Average Package by Dept</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.avgPackageByDept}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avgPackage" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-2 text-xs text-muted-foreground text-center">Average package by department</p>
            </CardContent>
          </Card>

          <Card>
              <CardHeader><CardTitle>Top 5 High Packages by Dept</CardTitle></CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.deptTopPackages}>
                  <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dept" />
                  <YAxis />
                  <Tooltip />
                    <Bar dataKey="maxPackage" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
                <p className="mt-2 text-xs text-muted-foreground text-center">Highest packages by department</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Placement Percentage Trend by PI</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metrics.piPercentage}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="pi" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="percentage" stroke="#22c55e" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
              <p className="mt-2 text-xs text-muted-foreground text-center">Placement percentage by PI</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Overall Placement Summary</CardTitle></CardHeader>
            <CardContent>
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary mb-2">
                    {metrics.totalStudents > 0 ? Math.round((metrics.totalPlaced / metrics.totalStudents) * 100) : 0}%
                  </div>
                  <p className="text-muted-foreground">Overall Placement Rate</p>
                  <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="font-semibold">{metrics.totalStudents}</div>
                      <div className="text-muted-foreground">Total Students</div>
                    </div>
                    <div>
                      <div className="font-semibold text-green-600">{metrics.totalPlaced}</div>
                      <div className="text-muted-foreground">Placed</div>
                    </div>
                    <div>
                      <div className="font-semibold text-red-600">{metrics.totalBalance}</div>
                      <div className="text-muted-foreground">Balance</div>
                    </div>
                  </div>
                </div>
            </CardContent>
          </Card>

          <Card>
              <CardHeader><CardTitle>Yearly/Batch-wise Career Growth</CardTitle></CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metrics.batchAvgPackageTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="batch" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="avgPackage" stroke="#3b82f6" />
                </LineChart>
              </ResponsiveContainer>
                <p className="mt-2 text-xs text-muted-foreground text-center">Average package trend across batches</p>
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
              Upload an Excel file to start analyzing placement offer data
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

export default CareerPlacementOffer;


