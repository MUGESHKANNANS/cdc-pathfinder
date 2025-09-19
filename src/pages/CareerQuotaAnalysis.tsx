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
  'S.No','Dept','Total','PI','Quota','Total MQ','PI MQ','Total GQ','PI GQ','Total International','PI International','Placed MQ','Placed GQ','Placed International','MQ Placed %','GQ Placed %','International Placed %','Total %'
];

const OPTIONAL_COLUMNS = ['Batch','Incharge','Package'];

const TEMPLATE_HEADERS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

const normalize = (s: string) => s?.trim().replace(/\s+/g, ' ').replace(/\u00A0/g, ' ');
const toNumber = (v: any): number => {
  const n = Number(String(v).toString().replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#22c55e', '#eab308'];

const CareerQuotaAnalysis: React.FC = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<RowData[]>([]);

  const [search, setSearch] = useState('');
  const [dept, setDept] = useState<string>('all');
  const [batch, setBatch] = useState<string>('all');
  const [pi, setPi] = useState<string>('all');
  const [incharge, setIncharge] = useState<string>('all');
  const [quota, setQuota] = useState<string>('all'); // MQ | GQ | International
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
    XLSX.writeFile(wb, 'career_quota_analysis_template.xlsx');
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
        data = parsed.map(r => {
          const m: RowData = {}; Object.entries(r).forEach(([k,v])=>{ m[normalize(k)] = v; }); return m;
        });
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
      const matchesQuota = quota === 'all' ? true : String(r['Quota']).toLowerCase() === quota.toLowerCase();
      const placedSum = toNumber(r['Placed MQ']) + toNumber(r['Placed GQ']) + toNumber(r['Placed International']);
      const matchesPlaced = placed === 'all' ? true : placed === 'placed' ? placedSum > 0 : placedSum === 0;
      
      const packageValue = toNumber(r['Package']);
      const matchesPackageMin = !packageMin || packageValue >= toNumber(packageMin);
      const matchesPackageMax = !packageMax || packageValue <= toNumber(packageMax);
      
      return matchesSearch && matchesDept && matchesBatch && matchesPi && matchesIncharge && matchesQuota && matchesPlaced && matchesPackageMin && matchesPackageMax;
    });
  }, [rows, search, dept, batch, pi, incharge, quota, placed, packageMin, packageMax]);

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
    // Totals
    const overall = filteredRows.reduce((acc, r) => {
      acc.totalMQ += toNumber(r['Total MQ']);
      acc.totalGQ += toNumber(r['Total GQ']);
      acc.totalIntl += toNumber(r['Total International']);
      acc.placedMQ += toNumber(r['Placed MQ']);
      acc.placedGQ += toNumber(r['Placed GQ']);
      acc.placedIntl += toNumber(r['Placed International']);
      acc.total += toNumber(r['Total']);
      const pkg = toNumber(r['Package']);
      if (pkg > 0) {
        const q = String(r['Quota'] || '').toLowerCase();
        if (q === 'mq') acc.pkgMQ.push(pkg);
        if (q === 'gq') acc.pkgGQ.push(pkg);
        if (q === 'international') acc.pkgIntl.push(pkg);
      }
      return acc;
    }, { totalMQ: 0, totalGQ: 0, totalIntl: 0, placedMQ: 0, placedGQ: 0, placedIntl: 0, total: 0, pkgMQ: [], pkgGQ: [], pkgIntl: [] });

    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;

    // Dept-wise
    const deptMap = new Map<string, { mq: number; gq: number; intl: number; placedMQ: number; placedGQ: number; placedIntl: number; mqPct: number; gqPct: number; intlPct: number; pkgMQ: number[]; pkgGQ: number[]; pkgIntl: number[] }>();
    filteredRows.forEach(r => {
      const d = String(r['Dept'] || 'NA');
      const cur = deptMap.get(d) || { mq: 0, gq: 0, intl: 0, placedMQ: 0, placedGQ: 0, placedIntl: 0, mqPct: 0, gqPct: 0, intlPct: 0, pkgMQ: [], pkgGQ: [], pkgIntl: [] };
      cur.mq += toNumber(r['Total MQ']);
      cur.gq += toNumber(r['Total GQ']);
      cur.intl += toNumber(r['Total International']);
      cur.placedMQ += toNumber(r['Placed MQ']);
      cur.placedGQ += toNumber(r['Placed GQ']);
      cur.placedIntl += toNumber(r['Placed International']);
      cur.mqPct += toNumber(r['MQ Placed %']);
      cur.gqPct += toNumber(r['GQ Placed %']);
      cur.intlPct += toNumber(r['International Placed %']);
      const pkg = toNumber(r['Package']);
      const q = String(r['Quota'] || '').toLowerCase();
      if (q === 'mq') cur.pkgMQ.push(pkg);
      if (q === 'gq') cur.pkgGQ.push(pkg);
      if (q === 'international') cur.pkgIntl.push(pkg);
      deptMap.set(d, cur);
    });

    const deptTotals = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, mq: v.mq, gq: v.gq, intl: v.intl }));
    const deptPlacedStack = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, mq: v.placedMQ, gq: v.placedGQ, intl: v.placedIntl }));
    const deptPctBars = Array.from(deptMap.entries()).map(([dept, v]) => ({ dept, mqPct: v.mq ? Math.round((v.placedMQ / v.mq) * 100) : 0, gqPct: v.gq ? Math.round((v.placedGQ / v.gq) * 100) : 0, intlPct: v.intl ? Math.round((v.placedIntl / v.intl) * 100) : 0 }));

    // Batch-wise
    const batchMap = new Map<string, { mq: number; gq: number; intl: number }>();
    filteredRows.forEach(r => { const b = String(r['Batch'] || 'NA'); const cur = batchMap.get(b) || { mq: 0, gq: 0, intl: 0 }; cur.mq += toNumber(r['Total MQ']); cur.gq += toNumber(r['Total GQ']); cur.intl += toNumber(r['Total International']); batchMap.set(b, cur); });
    const batchQuotaDist = Array.from(batchMap.entries()).map(([batch, v]) => ({ batch, mq: v.mq, gq: v.gq, intl: v.intl }));

    // PI-wise
    const piMap = new Map<string, { mq: number; gq: number; intl: number }>();
    filteredRows.forEach(r => { const p = String(r['PI'] || 'NA'); const cur = piMap.get(p) || { mq: 0, gq: 0, intl: 0 }; cur.mq += toNumber(r['Total MQ']); cur.gq += toNumber(r['Total GQ']); cur.intl += toNumber(r['Total International']); piMap.set(p, cur); });
    const piStrength = Array.from(piMap.entries()).map(([pi, v]) => ({ pi, mq: v.mq, gq: v.gq, intl: v.intl }));

    // Overall by quota
    const totalVsPlacedByQuota = [
      { quota: 'MQ', total: overall.totalMQ, placed: overall.placedMQ },
      { quota: 'GQ', total: overall.totalGQ, placed: overall.placedGQ },
      { quota: 'International', total: overall.totalIntl, placed: overall.placedIntl }
    ];

    const quotaRatio = [
      { name: 'MQ', value: overall.totalMQ },
      { name: 'GQ', value: overall.totalGQ },
      { name: 'International', value: overall.totalIntl },
    ];

    const quotaPctDonut = [
      { name: 'MQ %', value: overall.totalMQ ? Math.round((overall.placedMQ/overall.totalMQ)*100) : 0 },
      { name: 'GQ %', value: overall.totalGQ ? Math.round((overall.placedGQ/overall.totalGQ)*100) : 0 },
      { name: 'Intl %', value: overall.totalIntl ? Math.round((overall.placedIntl/overall.totalIntl)*100) : 0 },
    ];

    // Top 5 by placement percent per quota
    const topMQ = [...deptPctBars].sort((a,b)=>b.mqPct - a.mqPct).slice(0,5).map(x=>({ dept: x.dept, value: x.mqPct }));
    const topGQ = [...deptPctBars].sort((a,b)=>b.gqPct - a.gqPct).slice(0,5).map(x=>({ dept: x.dept, value: x.gqPct }));
    const topIntl = [...deptPctBars].sort((a,b)=>b.intlPct - a.intlPct).slice(0,5).map(x=>({ dept: x.dept, value: x.intlPct }));

    // Avg package by quota (overall)
    const avgPkgByQuota = [
      { quota: 'MQ', avg: avg(overall.pkgMQ) },
      { quota: 'GQ', avg: avg(overall.pkgGQ) },
      { quota: 'International', avg: avg(overall.pkgIntl) },
    ];

    // Avg package by dept and quota
    const avgPkgByDeptQuota = Array.from(deptMap.entries()).map(([dept, v]) => ({
      dept,
      mq: avg(v.pkgMQ),
      gq: avg(v.pkgGQ),
      intl: avg(v.pkgIntl)
    }));

    // Batch trend
    const batchTrend = Array.from(batchMap.entries()).map(([batch, v]) => ({
      batch,
      mq: v.mq,
      gq: v.gq,
      intl: v.intl
    }));

    // Overall summary
    const overallPlaced = overall.placedMQ + overall.placedGQ + overall.placedIntl;
    const overallPct = overall.total ? Math.round((overallPlaced / overall.total) * 100) : 0;

    return { deptTotals, deptPlacedStack, quotaPctDonut, batchQuotaDist, piStrength, deptPctBars, totalVsPlacedByQuota, quotaRatio, avgPkgByQuota, avgPkgByDeptQuota, topMQ, topGQ, topIntl, batchTrend, overallPct };
  }, [filteredRows]);

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Filtered');
    XLSX.writeFile(wb, 'career_quota_analysis_filtered.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('Career - Quota Analysis (Filtered)', 14, 22);
    
    const tableData = filteredRows.map(row => 
      [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS].map(header => row[header] || '')
    );
    
    doc.autoTable({
      head: [[...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS]],
      body: tableData,
      startY: 30,
    });
    
    doc.save('career_quota_analysis_filtered.pdf');
  };

  const resetFilters = () => {
    setSearch('');
    setDept('all');
    setBatch('all');
    setPi('all');
    setIncharge('all');
    setQuota('all');
    setPlaced('all');
    setPackageMin('');
    setPackageMax('');
    setCurrentPage(1);
  };

  return (
    <div className="p-6 space-y-6 overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Career - Quota Analysis</h1>
          <p className="text-muted-foreground">Upload Excel/CSV and analyze quota-wise placements</p>
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
                    <Label htmlFor="quota">Quota</Label>
                    <Select value={quota} onValueChange={setQuota}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Quotas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Quotas</SelectItem>
                        <SelectItem value="MQ">MQ</SelectItem>
                        <SelectItem value="GQ">GQ</SelectItem>
                        <SelectItem value="International">International</SelectItem>
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
                <CardTitle>Quota Analysis Data</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-w-full overflow-x-auto">
                  <table className="min-w-[1200px] border-collapse">
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
              <CardHeader><CardTitle>Dept-wise MQ vs GQ vs International Student Count</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={metrics.deptTotals}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="mq" fill="#3b82f6" />
                    <Bar dataKey="gq" fill="#ef4444" />
                    <Bar dataKey="intl" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Dept-wise MQ vs GQ vs International Placed Students</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={metrics.deptPlacedStack}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="mq" fill="#3b82f6" />
                    <Bar dataKey="gq" fill="#ef4444" />
                    <Bar dataKey="intl" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Quota Placement Percentage Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie dataKey="value" data={metrics.quotaPctDonut} cx="50%" cy="50%" outerRadius={100} label>
                      {metrics.quotaPctDonut.map((_, idx) => (<Cell key={idx} fill={COLORS[idx % COLORS.length]} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Batch-wise Quota Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.batchQuotaDist}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="batch" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="mq" fill="#3b82f6" />
                    <Bar dataKey="gq" fill="#ef4444" />
                    <Bar dataKey="intl" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>PI vs MQ/GQ/International Strength</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.piStrength}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="pi" interval={0} angle={-30} textAnchor="end" height={70} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="mq" fill="#3b82f6" />
                    <Bar dataKey="gq" fill="#ef4444" />
                    <Bar dataKey="intl" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Dept-wise MQ% vs GQ% vs International%</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={metrics.deptPctBars}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis domain={[0,100]} />
                    <Tooltip />
                    <Bar dataKey="mqPct" fill="#3b82f6" />
                    <Bar dataKey="gqPct" fill="#ef4444" />
                    <Bar dataKey="intlPct" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Total Students vs Placed Students by Quota</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.totalVsPlacedByQuota}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="quota" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="total" fill="#06b6d4" />
                    <Bar dataKey="placed" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Overall Quota Ratio</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie dataKey="value" data={metrics.quotaRatio} cx="50%" cy="50%" outerRadius={100} label>
                      {metrics.quotaRatio.map((_, idx) => (<Cell key={idx} fill={COLORS[idx % COLORS.length]} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Average Package by Quota</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.avgPkgByQuota}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="quota" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="avg" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Average Package by Department and Quota</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.avgPkgByDeptQuota}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dept" interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="mq" fill="#3b82f6" />
                    <Bar dataKey="gq" fill="#ef4444" />
                    <Bar dataKey="intl" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Top 5 Departments by MQ Placement %</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.topMQ}>
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
              <CardHeader><CardTitle>Top 5 Departments by GQ Placement %</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.topGQ}>
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
              <CardHeader><CardTitle>Top 5 Departments by International Placement %</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.topIntl}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dept" />
                    <YAxis domain={[0,100]} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Quota Placement Trend Across Batches</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics.batchTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="batch" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="mq" stroke="#3b82f6" />
                    <Line type="monotone" dataKey="gq" stroke="#ef4444" />
                    <Line type="monotone" dataKey="intl" stroke="#10b981" />
                  </LineChart>
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
              Upload an Excel file to start analyzing quota data
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

export default CareerQuotaAnalysis;