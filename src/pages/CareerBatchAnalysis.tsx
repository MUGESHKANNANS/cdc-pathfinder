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
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  LineChart, Line, Tooltip, ResponsiveContainer, ScatterChart, Scatter, 
  ZAxis, AreaChart, Area, ComposedChart, Legend, BoxPlot, Heatmap
} from 'recharts';
import jsPDF from 'jspdf';
import { Search, Filter, Download, Upload, FileSpreadsheet, BarChart3, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type RowData = { [key: string]: any };

// Required columns for batch analysis
const REQUIRED_COLUMNS = [
  'S.No', 'Dept', 'Total', 'PI', 'No Of Student Placed', 'Balance', 'Batch', 'Package', 'Placed Percentage'
];

const TEMPLATE_HEADERS = REQUIRED_COLUMNS;

const normalize = (s: string) => s?.trim().replace(/\s+/g, ' ').replace(/\u00A0/g, ' ');
const toNumber = (v: any): number => {
  const n = Number(String(v).toString().replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#22c55e', '#eab308'];

const CareerBatchAnalysis: React.FC = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<RowData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState<string>('all');
  const [batch, setBatch] = useState<string>('all');
  const [pi, setPi] = useState<string>('all');
  const [incharge, setIncharge] = useState<string>('all');
  const [placed, setPlaced] = useState<string>('all');
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
    XLSX.writeFile(wb, 'career_batch_analysis_template.xlsx');
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

      setRows(data);
      setHeaders(fileHeaders);
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
      const batchMatch = batch === 'all' || row.Batch === batch;
      const piMatch = pi === 'all' || row.PI === pi;
      const inchargeMatch = incharge === 'all' || row.Incharge === incharge;
      
      let placedMatch = true;
      if (placed === 'placed') {
        placedMatch = toNumber(row['No Of Student Placed']) > 0;
      } else if (placed === 'not') {
        placedMatch = toNumber(row['No Of Student Placed']) === 0;
      }

      const packageMatch = (!packageMin || toNumber(row.Package) >= toNumber(packageMin)) &&
                         (!packageMax || toNumber(row.Package) <= toNumber(packageMax));

      return searchMatch && deptMatch && batchMatch && piMatch && inchargeMatch && placedMatch && packageMatch;
    });
  }, [rows, search, dept, batch, pi, incharge, placed, packageMin, packageMax]);

  // Get unique values for filters
  const uniqueDepts = useMemo(() => [...new Set(rows.map(r => r.Dept).filter(Boolean))], [rows]);
  const uniqueBatches = useMemo(() => [...new Set(rows.map(r => r.Batch).filter(Boolean))], [rows]);
  const uniquePIs = useMemo(() => [...new Set(rows.map(r => r.PI).filter(Boolean))], [rows]);
  const uniqueIncharges = useMemo(() => [...new Set(rows.map(r => r.Incharge).filter(Boolean))], [rows]);

  // Pagination
  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
  const paginatedRows = filteredRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Data processing for visualizations
  const batchData = useMemo(() => {
    const batchMap = new Map();
    
    rows.forEach(row => {
      const batch = row.Batch;
      if (!batch) return;
      
      if (!batchMap.has(batch)) {
        batchMap.set(batch, {
          batch,
          total: 0,
          placed: 0,
          balance: 0,
          package: 0,
          packageCount: 0,
          deptBreakdown: new Map(),
          piBreakdown: new Map()
        });
      }
      
      const batchData = batchMap.get(batch);
      batchData.total += toNumber(row.Total);
      batchData.placed += toNumber(row['No Of Student Placed']);
      batchData.balance += toNumber(row.Balance);
      
      const pkg = toNumber(row.Package);
      if (pkg > 0) {
        batchData.package += pkg;
        batchData.packageCount += 1;
      }
      
      // Department breakdown
      const dept = row.Dept;
      if (dept) {
        if (!batchData.deptBreakdown.has(dept)) {
          batchData.deptBreakdown.set(dept, { total: 0, placed: 0 });
        }
        const deptData = batchData.deptBreakdown.get(dept);
        deptData.total += toNumber(row.Total);
        deptData.placed += toNumber(row['No Of Student Placed']);
      }
      
      // PI breakdown
      const pi = row.PI;
      if (pi) {
        if (!batchData.piBreakdown.has(pi)) {
          batchData.piBreakdown.set(pi, { total: 0, placed: 0 });
        }
        const piData = batchData.piBreakdown.get(pi);
        piData.total += toNumber(row.Total);
        piData.placed += toNumber(row['No Of Student Placed']);
      }
    });
    
    return Array.from(batchMap.values()).map(data => ({
      ...data,
      placementPercentage: data.total > 0 ? (data.placed / data.total) * 100 : 0,
      avgPackage: data.packageCount > 0 ? data.package / data.packageCount : 0,
      deptBreakdown: Array.from(data.deptBreakdown.entries()).map(([dept, stats]) => ({
        dept,
        ...stats,
        percentage: stats.total > 0 ? (stats.placed / stats.total) * 100 : 0
      })),
      piBreakdown: Array.from(data.piBreakdown.entries()).map(([pi, stats]) => ({
        pi,
        ...stats,
        percentage: stats.total > 0 ? (stats.placed / stats.total) * 100 : 0
      }))
    })).sort((a, b) => a.batch.localeCompare(b.batch));
  }, [rows]);

  // Export functions
  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Batch Analysis');
    XLSX.writeFile(wb, 'batch_analysis_export.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('Career Batch Analysis Report', 20, 20);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30);
    doc.text(`Total Records: ${filteredRows.length}`, 20, 40);
    doc.save('batch_analysis_report.pdf');
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Career - Batch Analysis</h1>
          <p className="text-muted-foreground">Upload Excel data and analyze batch-wise placement performance</p>
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
                        {uniqueDepts.map(dept => (
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
                        {uniqueBatches.map(batch => (
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
                        {uniquePIs.map(pi => (
                          <SelectItem key={pi} value={pi}>{pi}</SelectItem>
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
                <CardTitle>Batch Analysis Data</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">S.No</th>
                        <th className="text-left p-2">Dept</th>
                        <th className="text-left p-2">Total</th>
                        <th className="text-left p-2">PI</th>
                        <th className="text-left p-2">Placed</th>
                        <th className="text-left p-2">Balance</th>
                        <th className="text-left p-2">Batch</th>
                        <th className="text-left p-2">Package</th>
                        <th className="text-left p-2">Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows.map((row, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="p-2">{row['S.No']}</td>
                          <td className="p-2">{row.Dept}</td>
                          <td className="p-2">{row.Total}</td>
                          <td className="p-2">{row.PI}</td>
                          <td className="p-2">{row['No Of Student Placed']}</td>
                          <td className="p-2">{row.Balance}</td>
                          <td className="p-2">{row.Batch}</td>
                          <td className="p-2">{row.Package}</td>
                          <td className="p-2">{row['Placed Percentage']}%</td>
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
              {/* 1. Batch-wise Total Students (Bar Chart) */}
              <Card>
                <CardHeader>
                  <CardTitle>Batch-wise Total Students</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={batchData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="batch" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="total" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 2. Batch-wise Students Placed (Bar Chart) */}
              <Card>
                <CardHeader>
                  <CardTitle>Batch-wise Students Placed</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={batchData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="batch" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="placed" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 3. Batch Placement Percentage (Line Chart) */}
              <Card>
                <CardHeader>
                  <CardTitle>Batch Placement Percentage Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={batchData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="batch" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`${value.toFixed(1)}%`, 'Placement %']} />
                      <Line type="monotone" dataKey="placementPercentage" stroke="#8b5cf6" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 4. Batch vs Balance (Stacked Bar) */}
              <Card>
                <CardHeader>
                  <CardTitle>Batch: Placed vs Balance Students</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={batchData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="batch" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="placed" stackId="a" fill="#10b981" name="Placed" />
                      <Bar dataKey="balance" stackId="a" fill="#ef4444" name="Balance" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 5. Average Package by Batch (Column Chart) */}
              <Card>
                <CardHeader>
                  <CardTitle>Average Package by Batch</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={batchData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="batch" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`₹${value.toLocaleString()}`, 'Avg Package']} />
                      <Bar dataKey="avgPackage" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 6. Top 5 Batches by Placed Percentage (Horizontal Bar) */}
              <Card>
                <CardHeader>
                  <CardTitle>Top 5 Batches by Placement %</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart 
                      data={batchData
                        .sort((a, b) => b.placementPercentage - a.placementPercentage)
                        .slice(0, 5)
                      }
                      layout="horizontal"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="batch" type="category" width={80} />
                      <Tooltip formatter={(value) => [`${value.toFixed(1)}%`, 'Placement %']} />
                      <Bar dataKey="placementPercentage" fill="#06b6d4" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 7. Placed vs Not Placed (Donut Chart) - Overall */}
              <Card>
                <CardHeader>
                  <CardTitle>Overall: Placed vs Not Placed</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[{
                          name: 'Placed',
                          value: batchData.reduce((sum, batch) => sum + batch.placed, 0)
                        }, {
                          name: 'Not Placed',
                          value: batchData.reduce((sum, batch) => sum + batch.balance, 0)
                        }]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        dataKey="value"
                      >
                        {[0, 1].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 8. Cumulative Placements Over Batches (Area Chart) */}
              <Card>
                <CardHeader>
                  <CardTitle>Cumulative Placements Over Batches</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={batchData.map((batch, index) => ({
                      ...batch,
                      cumulative: batchData.slice(0, index + 1).reduce((sum, b) => sum + b.placed, 0)
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="batch" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="cumulative" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 9. Dept Contribution Within Batch (Stacked Column) */}
              <Card>
                <CardHeader>
                  <CardTitle>Department Contribution by Batch</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={batchData.slice(0, 5)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="batch" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {uniqueDepts.slice(0, 5).map((dept, index) => (
                        <Bar 
                          key={dept}
                          dataKey={`dept_${dept}`} 
                          stackId="a" 
                          fill={COLORS[index % COLORS.length]} 
                          name={dept}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 10. Package Range Frequency per Batch (Histogram) */}
              <Card>
                <CardHeader>
                  <CardTitle>Package Distribution by Batch</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={batchData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="batch" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`${value}`, 'Package Count']} />
                      <Bar dataKey="packageCount" fill="#22c55e" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 11. Batch vs PI Performance (Grouped Bar) */}
              <Card>
                <CardHeader>
                  <CardTitle>PI Performance Across Batches</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={batchData.slice(0, 5)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="batch" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {uniquePIs.slice(0, 3).map((pi, index) => (
                        <Bar 
                          key={pi}
                          dataKey={`pi_${pi}`} 
                          fill={COLORS[index % COLORS.length]} 
                          name={pi}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 12. Placement Growth Rate (Line Chart) */}
              <Card>
                <CardHeader>
                  <CardTitle>Placement Growth Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={batchData.map((batch, index) => ({
                      ...batch,
                      growthRate: index > 0 ? 
                        ((batch.placementPercentage - batchData[index - 1].placementPercentage) / batchData[index - 1].placementPercentage) * 100 : 0
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="batch" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`${value.toFixed(1)}%`, 'Growth Rate']} />
                      <Line type="monotone" dataKey="growthRate" stroke="#eab308" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 13. Overall Placement Summary (Gauge Chart) */}
              <Card>
                <CardHeader>
                  <CardTitle>Overall Placement Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-primary mb-2">
                      {batchData.length > 0 ? 
                        (batchData.reduce((sum, batch) => sum + batch.placed, 0) / 
                         batchData.reduce((sum, batch) => sum + batch.total, 0) * 100).toFixed(1) : 0}%
                    </div>
                    <p className="text-muted-foreground">Overall Placement Rate</p>
                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="font-semibold">Total Students</div>
                        <div>{batchData.reduce((sum, batch) => sum + batch.total, 0)}</div>
                      </div>
                      <div>
                        <div className="font-semibold">Placed Students</div>
                        <div>{batchData.reduce((sum, batch) => sum + batch.placed, 0)}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 14. Batch-wise Package Distribution (Box Plot) */}
              <Card>
                <CardHeader>
                  <CardTitle>Package Distribution by Batch</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <ScatterChart data={batchData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="batch" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`₹${value.toLocaleString()}`, 'Package']} />
                      <Scatter dataKey="avgPackage" fill="#8b5cf6" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 15. Heatmap: Batch vs Dept - Placed Percentage */}
              <Card>
                <CardHeader>
                  <CardTitle>Heatmap: Batch vs Department Placement %</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {batchData.slice(0, 5).map(batch => (
                      <div key={batch.batch} className="flex items-center gap-2">
                        <div className="w-20 text-sm font-medium">{batch.batch}</div>
                        <div className="flex-1 grid grid-cols-5 gap-1">
                          {uniqueDepts.slice(0, 5).map(dept => {
                            const deptData = batch.deptBreakdown.find(d => d.dept === dept);
                            const percentage = deptData?.percentage || 0;
                            return (
                              <div
                                key={dept}
                                className="h-8 rounded text-xs flex items-center justify-center text-white"
                                style={{
                                  backgroundColor: `hsl(${120 - (percentage * 1.2)}, 70%, 50%)`,
                                  opacity: percentage > 0 ? 1 : 0.3
                                }}
                                title={`${dept}: ${percentage.toFixed(1)}%`}
                              >
                                {percentage > 0 ? `${percentage.toFixed(0)}%` : '-'}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-20 text-sm font-medium">Dept:</div>
                      <div className="flex-1 grid grid-cols-5 gap-1">
                        {uniqueDepts.slice(0, 5).map(dept => (
                          <div key={dept} className="text-xs text-center">{dept}</div>
                        ))}
                      </div>
                    </div>
                  </div>
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
              Upload an Excel file to start analyzing batch-wise placement data
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

export default CareerBatchAnalysis;
