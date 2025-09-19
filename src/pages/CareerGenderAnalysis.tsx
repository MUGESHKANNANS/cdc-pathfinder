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
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Search, Filter, Download, Upload, FileSpreadsheet, BarChart3, TrendingUp } from 'lucide-react';

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
      const matchesGender = gender === 'all' ? true : String(r['Gender']).toLowerCase() === gender.toLowerCase();
      const placedCount = toNumber(r['Placed Male']) + toNumber(r['Placed Female']);
      const matchesPlaced = placed === 'all' ? true : placed === 'placed' ? placedCount > 0 : placedCount === 0;
      
      const packageValue = toNumber(r['Package']);
      const matchesPackageMin = !packageMin || packageValue >= toNumber(packageMin);
      const matchesPackageMax = !packageMax || packageValue <= toNumber(packageMax);
      
      return matchesSearch && matchesDept && matchesBatch && matchesPi && matchesGender && matchesPlaced && matchesPackageMin && matchesPackageMax;
    });
  }, [rows, search, dept, batch, pi, gender, placed, packageMin, packageMax]);

  const departments = useMemo(() => Array.from(new Set(rows.map(r => r['Dept']).filter(Boolean))) as string[], [rows]);
  const batches = useMemo(() => Array.from(new Set(rows.map(r => r['Batch']).filter(Boolean))) as string[], [rows]);
  const pis = useMemo(() => Array.from(new Set(rows.map(r => r['PI']).filter(Boolean))) as string[], [rows]);

  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const metrics = useMemo(() => {
    // Dept aggregates
    const deptMap = new Map<string, { male: number; female: number; placedMale: number; placedFemale: number; malePct: number; femalePct: number; totalPlaced: number; total: number; pkgMale: number[]; pkgFemale: number[] }>();
    filteredRows.forEach(r => {
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
    filteredRows.forEach(r => { const p = String(r['PI'] || 'NA'); const cur = piMap.get(p) || { male: 0, female: 0 }; cur.male += toNumber(r['Total Male']); cur.female += toNumber(r['Total Female']); piMap.set(p, cur); });
    const piStrength = Array.from(piMap.entries()).map(([pi, v]) => ({ pi, male: v.male, female: v.female }));

    // Batch-wise
    const batchMap = new Map<string, { male: number; female: number }>();
    filteredRows.forEach(r => { const b = String(r['Batch'] || 'NA'); const cur = batchMap.get(b) || { male: 0, female: 0 }; cur.male += toNumber(r['Total Male']); cur.female += toNumber(r['Total Female']); batchMap.set(b, cur); });
    const batchDistribution = Array.from(batchMap.entries()).map(([batch, v]) => ({ batch, male: v.male, female: v.female }));

    // Growth trend
    const genderGrowthTrend = Array.from(batchMap.entries()).map(([batch, v]) => ({ batch, placedMale: v.male, placedFemale: v.female }));

    // Overall gender ratio
    const overallGenderRatio = [
      { name: 'Male', value: totalMale },
      { name: 'Female', value: totalFemale }
    ];

    // Total vs placed by gender
    const totalVsPlacedByGender = [
      { gender: 'Male', total: totalMale, placed: placedMale },
      { gender: 'Female', total: totalFemale, placed: placedFemale }
    ];

    // Average package by gender and dept
    const avgPkgByGenderDept = Array.from(deptMap.entries()).map(([dept, v]) => ({
      dept,
      male: v.pkgMale.length ? Math.round(v.pkgMale.reduce((s, p) => s + p, 0) / v.pkgMale.length) : 0,
      female: v.pkgFemale.length ? Math.round(v.pkgFemale.reduce((s, p) => s + p, 0) / v.pkgFemale.length) : 0
    }));

    // Top 5 by female %
    const topFemalePct = deptMaleFemalePct.sort((a, b) => b.femalePct - a.femalePct).slice(0, 5);
    const topMalePct = deptMaleFemalePct.sort((a, b) => b.malePct - a.malePct).slice(0, 5);

    // Contribution
    const contribution = Array.from(batchMap.entries()).map(([batch, v]) => ({
      batch,
      pctMale: v.male ? Math.round((v.male / (v.male + v.female)) * 100) : 0,
      pctFemale: v.female ? Math.round((v.female / (v.male + v.female)) * 100) : 0
    }));

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
  }, [filteredRows]);

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Filtered');
    XLSX.writeFile(wb, 'career_gender_analysis_filtered.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('Career - Gender Analysis (Filtered)', 14, 22);
    
    const tableData = filteredRows.map(row => 
      REQUIRED_COLUMNS.map(header => row[header] || '')
    );
    
    doc.autoTable({
      head: [REQUIRED_COLUMNS],
      body: tableData,
      startY: 30,
    });
    
    doc.save('career_gender_analysis_filtered.pdf');
  };

  const resetFilters = () => {
    setSearch('');
    setDept('all');
    setBatch('all');
    setPi('all');
    setGender('all');
    setPlaced('all');
    setPackageMin('');
    setPackageMax('');
    setCurrentPage(1);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Career - Gender Analysis</h1>
          <p className="text-muted-foreground">Upload Excel/CSV and analyze gender-wise placements</p>
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
                    <Label htmlFor="gender">Gender</Label>
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Gender</SelectItem>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
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
                <CardTitle>Gender Analysis Data</CardTitle>
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
              <CardHeader><CardTitle>Dept-wise Male vs Female Placed Students</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={metrics.deptPlacedStack}>
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
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie dataKey="value" data={metrics.overallGenderRatio} cx="50%" cy="50%" outerRadius={100} label>
                      {metrics.overallGenderRatio.map((_, idx) => (<Cell key={idx} fill={COLORS[idx % COLORS.length]} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Batch Distribution by Gender</CardTitle></CardHeader>
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
              <CardHeader><CardTitle>Gender Growth Trend Across Batches</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
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
              <CardHeader><CardTitle>Average Package by Gender and Department</CardTitle></CardHeader>
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
              <CardHeader><CardTitle>Top 5 Departments by Female Placement %</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.topFemalePct}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dept" />
                    <YAxis domain={[0,100]} />
                    <Tooltip />
                    <Bar dataKey="femalePct" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Top 5 Departments by Male Placement %</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.topMalePct}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dept" />
                    <YAxis domain={[0,100]} />
                    <Tooltip />
                    <Bar dataKey="malePct" fill="#3b82f6" />
                  </BarChart>
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
          </TabsContent>
        </Tabs>
      )}

      {rows.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <FileSpreadsheet className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Data Uploaded</h3>
            <p className="text-muted-foreground mb-4">
              Upload an Excel file to start analyzing gender data
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

export default CareerGenderAnalysis;