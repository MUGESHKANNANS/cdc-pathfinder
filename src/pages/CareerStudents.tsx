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
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis, ComposedChart, AreaChart, Area } from 'recharts';
import jsPDF from 'jspdf';
import { Search, Filter, Download, Upload, FileSpreadsheet, BarChart3, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const REQUIRED_COLUMNS = [
  'S.No', 'Reg Number', 'RollNo', 'Name', 'Dept', 'Section', 'PI', 'Job Vertical', 'Job Vertical (IT, CORE, BDE)',
  '10th', '12th', 'Diploma', 'CGPA', 'CutOff', 'Training Batch', 'Gender',
  'Company 1', 'Salary (Company 1)', 'Organized By (Company 1)', 'Offer Letter Link (Company 1)', 'Join Letter Link (Company 1)',
  'Number Of Company Placed', 'Placed or Non Placed', 'Maximum Salary', 'Quota', 'Hosteller / Days scholar', 'Company Joined'
];

const TEMPLATE_HEADERS = [
  'S.No','Reg Number','RollNo','Name','Dept','Section','PI','Job Vertical (IT, CORE, BDE)','10th','12th','Diploma','CGPA','CutOff','Training Batch','Gender',
  'Company 1','Salary (Company 1)','Organized By (Company 1)','Offer Letter Link (Company 1)','Join Letter Link (Company 1)',
  'Company 2','Salary (Company 2)','Organized By (Company 2)','Offer Letter Link (Company 2)','Join Letter Link (Company 2)',
  'Company 3','Salary (Company 3)','Organized By (Company 3)','Offer Letter Link (Company 3)','Join Letter Link (Company 3)',
  'Company 4','Salary (Company 4)','Organized By (Company 4)','Offer Letter Link (Company 4)','Join Letter Link (Company 4)',
  'Company 5','Salary (Company 5)','Organized By (Company 5)','Offer Letter Link (Company 5)','Join Letter Link (Company 5)',
  'Company 6','Salary (Company 6)','Organized By (Company 6)','Offer Letter Link (Company 6)','Join Letter Link (Company 6)',
  'Company 7','Salary (Company 7)','Organized By (Company 7)','Offer Letter Link (Company 7)','Join Letter Link (Company 7)',
  'Company 8','Salary (Company 8)','Organized By (Company 8)','Offer Letter Link (Company 8)','Join Letter Link (Company 8)',
  'Company 9','Salary (Company 9)','Organized By (Company 9)','Offer Letter Link (Company 9)','Join Letter Link (Company 9)',
  'Company 10','Salary (Company 10)','Organized By (Company 10)','Offer Letter Link (Company 10)','Join Letter Link (Company 10)',
  'Number Of Company Placed','Placed or Non Placed','Maximum Salary','Quota','Hosteller / Days scholar','Company Joined'
];

const normalize = (s: string) => s?.trim().replace(/\s+/g, ' ').replace(/\u00A0/g, ' ');
const toNumber = (v: any): number => {
  const n = Number(String(v ?? '').toString().replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

interface RowData { [key: string]: any }

const CareerStudents: React.FC = () => {
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
  const [placed, setPlaced] = useState<string>('all');
  const [gender, setGender] = useState<string>('all');
  const [quota, setQuota] = useState<string>('all');
  const [hostelType, setHostelType] = useState<string>('all');
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

  const handleFile = async (file: File) => {
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['xlsx', 'csv'].includes(ext || '')) {
        toast({ title: 'Invalid file', description: 'Please upload a .xlsx or .csv file', variant: 'destructive' });
        return;
      }

      let data: RowData[] = [];
      if (ext === 'csv') {
        const text = await file.text();
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        data = (result.data as RowData[]).map(r => Object.fromEntries(Object.entries(r).map(([k,v])=>[normalize(k), v])));
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' }) as RowData[];
        data = json.map(r => Object.fromEntries(Object.entries(r).map(([k,v])=>[normalize(k), v])));
      }

      const headers = Object.keys(data[0] || {});
      const required = REQUIRED_COLUMNS.filter(c => c.startsWith('Job Vertical') ? false : true);
      const hasJobVertical = headers.includes('Job Vertical') || headers.includes('Job Vertical (IT, CORE, BDE)');
      const missing = required.filter(c => !headers.includes(c));
      if (missing.length) {
        toast({ title: 'Validation failed', description: `Missing columns: ${[...missing, !hasJobVertical ? 'Job Vertical' : ''].filter(Boolean).join(', ')}`, variant: 'destructive' });
        return;
      }

      setRows(data);
      setHeaders(Object.keys(data[0] || {}));
      setCurrentPage(1);
      toast({ title: 'Upload successful', description: `${data.length} records loaded` });
    } catch (e: any) {
      toast({ title: 'Parse error', description: e.message || 'Failed to parse file', variant: 'destructive' });
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
      const genderMatch = gender === 'all' || row.Gender === gender;
      const quotaMatch = quota === 'all' || row.Quota === quota;
      const hostelMatch = hostelType === 'all' || row['Hosteller / Days scholar'] === hostelType;
      
      let placedMatch = true;
      if (placed === 'placed') {
        placedMatch = String(row['Placed or Non Placed'] || '').toLowerCase().includes('placed');
      } else if (placed === 'not') {
        placedMatch = !String(row['Placed or Non Placed'] || '').toLowerCase().includes('placed');
      }

      const salaryMatch = (!salaryMin || Number(row['Maximum Salary']) >= Number(salaryMin)) &&
                         (!salaryMax || Number(row['Maximum Salary']) <= Number(salaryMax));

      return searchMatch && deptMatch && batchMatch && piMatch && 
             genderMatch && quotaMatch && hostelMatch && placedMatch && salaryMatch;
    });
  }, [rows, search, dept, batch, pi, gender, quota, hostelType, placed, salaryMin, salaryMax]);

  // Get unique values for filters
  const deptOptions = useMemo(() => Array.from(new Set(rows.map(r => r['Dept']).filter(Boolean))) as string[], [rows]);
  const batchOptions = useMemo(() => Array.from(new Set(rows.map(r => r['Training Batch']).filter(Boolean))) as string[], [rows]);
  const piOptions = useMemo(() => Array.from(new Set(rows.map(r => r['PI']).filter(Boolean))) as string[], [rows]);

  // Pagination
  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
  const paginatedRows = filteredRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Metrics for extended visualizations
  const metrics = useMemo(() => {
    const placed = (r: any) => String(r['Placed or Non Placed'] || '').toLowerCase().includes('placed');

    const cgpaVsSalary = filteredRows.map((r, idx) => ({ x: toNumber(r['CGPA']), y: toNumber(r['Maximum Salary']), name: String(r['Name'] || ''), idx }));

    const marksVsPlaced = ['10th','12th'].map(key => ({
      key,
      placed: filteredRows.filter(r => placed(r)).reduce((s,r)=>s + toNumber(r[key]), 0),
      not: filteredRows.filter(r => !placed(r)).reduce((s,r)=>s + toNumber(r[key]), 0)
    }));

    const cutoffVsCompanies = filteredRows
      .map(r => ({ cutoff: toNumber(r['CutOff']), companies: toNumber(r['Number Of Company Placed']) }))
      .sort((a,b)=>a.cutoff-b.cutoff);

    const companyKeys = Array.from({ length: 10 }, (_, i) => `Company ${i+1}`);
    const salaryKeys = Array.from({ length: 10 }, (_, i) => `Salary (Company ${i+1})`);
    const organizedKeys = Array.from({ length: 10 }, (_, i) => `Organized By (Company ${i+1})`);

    const companyCountMap = new Map<string, number>();
    const companySalaryMap = new Map<string, number[]>();
    const organizedByMap = new Map<string, number>();
    const studentOfferHistogram = new Map<number, number>();

    filteredRows.forEach(r => {
      // offers
      const offers = toNumber(r['Number Of Company Placed']);
      studentOfferHistogram.set(offers, (studentOfferHistogram.get(offers)||0) + 1);
      for (let i=0;i<companyKeys.length;i++) {
        const cname = String(r[companyKeys[i]] || '').trim();
        const spkg = toNumber(r[salaryKeys[i]]);
        const org = String(r[organizedKeys[i]] || '').trim();
        if (!cname) continue;
        companyCountMap.set(cname, (companyCountMap.get(cname)||0) + 1);
        if (Number.isFinite(spkg) && spkg>0) {
          const arr = companySalaryMap.get(cname) || []; arr.push(spkg); companySalaryMap.set(cname, arr);
        }
        if (org) organizedByMap.set(org, (organizedByMap.get(org)||0) + 1);
      }
    });

    const companyCount = Array.from(companyCountMap.entries()).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([company, count])=>({ company, count }));
    const topCompaniesByAvg = Array.from(companySalaryMap.entries())
      .map(([company, arr]) => ({ company, avg: arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0 }))
      .sort((a,b)=>b.avg-a.avg).slice(0,5);

    const companySalaryDist = Array.from(companySalaryMap.entries()).map(([company, arr]) => ({ company, max: Math.max(...arr), min: Math.min(...arr), avg: Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) }));

    const offersHistogram = Array.from(studentOfferHistogram.entries()).sort((a,b)=>a[0]-b[0]).map(([offers, count])=>({ offers, count }));

    const placedDonut = [
      { name: 'Placed', value: filteredRows.filter(placed).length },
      { name: 'Not Placed', value: filteredRows.length - filteredRows.filter(placed).length }
    ];

    const singleVsMulti = [
      { name: 'Single Offer', value: filteredRows.filter(r => toNumber(r['Number Of Company Placed']) === 1).length },
      { name: 'Multiple Offers', value: filteredRows.filter(r => toNumber(r['Number Of Company Placed']) > 1).length }
    ];

    const deptPct = Array.from(new Set(filteredRows.map(r=>String(r['Dept'])))).map(dept => {
      const list = filteredRows.filter(r=>String(r['Dept'])===dept);
      const p = list.filter(placed).length;
      return { dept, pct: list.length ? Math.round((p/list.length)*100) : 0 };
    });

    const sectionCompare = Array.from(new Set(filteredRows.map(r=>String(r['Section']||'NA')))).map(section => {
      const list = filteredRows.filter(r=>String(r['Section']||'NA')===section);
      return { section, placed: list.filter(placed).length, total: list.length };
    });

    const batchPct = Array.from(new Set(filteredRows.map(r=>String(r['Training Batch']||'NA')))).map(batch => {
      const list = filteredRows.filter(r=>String(r['Training Batch']||'NA')===batch);
      const p = list.filter(placed).length;
      return { batch, pct: list.length ? Math.round((p/list.length)*100) : 0 };
    });

    const genderRatio = Array.from(new Set(filteredRows.map(r=>String(r['Gender']||'NA')))).map(gender => ({ gender, value: filteredRows.filter(r=>String(r['Gender']||'NA')===gender && placed(r)).length }));
    const quotaDonut = ['MQ','GQ','International'].map(q => ({ name: q, value: filteredRows.filter(r=>String(r['Quota']||'').toUpperCase()===q && placed(r)).length }));
    const quotaVsMax = Array.from(new Set(filteredRows.map(r=>String(r['Quota']||'NA')))).map(q => ({ quota: q, max: Math.max(...filteredRows.filter(r=>String(r['Quota']||'NA')===q).map(r=>toNumber(r['Maximum Salary'])||0)) || 0 }));

    const hostelPct = Array.from(new Set(filteredRows.map(r=>String(r['Hosteller / Days scholar']||'NA')))).map(type => {
      const list = filteredRows.filter(r=>String(r['Hosteller / Days scholar']||'NA')===type);
      const p = list.filter(placed).length; return { type, pct: list.length ? Math.round((p/list.length)*100) : 0 };
    });
    const hostelAvg = Array.from(new Set(filteredRows.map(r=>String(r['Hosteller / Days scholar']||'NA')))).map(type => {
      const list = filteredRows.filter(r=>String(r['Hosteller / Days scholar']||'NA')===type);
      const pkgs = list.map(r=>toNumber(r['Maximum Salary'])).filter(v=>v>0);
      const avg = pkgs.length ? Math.round(pkgs.reduce((a,b)=>a+b,0)/pkgs.length) : 0;
      return { type, avg };
    });

    const maxSalaryByDept = Array.from(new Set(filteredRows.map(r=>String(r['Dept'])))).map(dept => ({ dept, max: Math.max(...filteredRows.filter(r=>String(r['Dept'])===dept).map(r=>toNumber(r['Maximum Salary'])||0)) || 0 }));
    const avgSalaryBySection = Array.from(new Set(filteredRows.map(r=>String(r['Section']||'NA')))).map(section => {
      const list = filteredRows.filter(r=>String(r['Section']||'NA')===section);
      const pkgs = list.map(r=>toNumber(r['Maximum Salary'])).filter(v=>v>0);
      const avg = pkgs.length ? Math.round(pkgs.reduce((a,b)=>a+b,0)/pkgs.length) : 0;
      return { section, avg };
    });

    // Salary range histogram buckets of size 2 (LPA)
    const salaryBuckets = new Map<string, number>();
    filteredRows.forEach(r => { const s = toNumber(r['Maximum Salary']); if (!Number.isFinite(s) || s<=0) return; const start = Math.floor(s/2)*2; const key = `${start}-${start+2}`; salaryBuckets.set(key, (salaryBuckets.get(key)||0)+1); });
    const salaryHistogram = Array.from(salaryBuckets.entries()).sort((a,b)=>Number(a[0].split('-')[0])-Number(b[0].split('-')[0])).map(([range,count])=>({ range, count }));

    const top10Students = [...filteredRows]
      .map(r => ({ name: String(r['Name']||'NA'), dept: String(r['Dept']||'NA'), pkg: toNumber(r['Maximum Salary']) }))
      .sort((a,b)=>b.pkg-a.pkg)
      .slice(0,10);

    const placedThresholds = [2,3,5].map(t => ({ threshold: `${t}+`, count: filteredRows.filter(r => toNumber(r['Number Of Company Placed']) >= t).length }));

    const companyVsHighest = Array.from(companySalaryMap.entries()).slice(0,20).map(([company, arr]) => ({ x: company, y: Math.max(...arr), z: arr.length }));

    const organizedTrend = Array.from(organizedByMap.entries()).map(([org, count])=>({ org, count }));

    return { cgpaVsSalary, marksVsPlaced, cutoffVsCompanies, companyCount, companySalaryDist, topCompaniesByAvg, offersHistogram, placedDonut, singleVsMulti, deptPct, sectionCompare, batchPct, genderRatio, quotaDonut, quotaVsMax, hostelPct, hostelAvg, maxSalaryByDept, avgSalaryBySection, salaryHistogram, top10Students, placedThresholds, companyVsHighest, organizedTrend };
  }, [filteredRows]);

  // Export functions
  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'students_export.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('Career Students Report', 20, 20);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30);
    doc.text(`Total Records: ${filteredRows.length}`, 20, 40);
    doc.save('students_report.pdf');
  };

  const resetFilters = () => {
    setSearch('');
    setDept('all');
    setBatch('all');
    setPi('all');
    setPlaced('all');
    setGender('all');
    setQuota('all');
    setHostelType('all');
    setSalaryMin('');
    setSalaryMax('');
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'career_student_template.xlsx');
  };

  const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#22c55e', '#eab308'];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Career - Student List</h1>
          <p className="text-muted-foreground">Upload Excel/CSV and browse students</p>
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
                <CardTitle>Students Data</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Reg No</th>
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Dept</th>
                        <th className="text-left p-2">PI</th>
                        <th className="text-left p-2">CGPA</th>
                        <th className="text-left p-2">Max Salary</th>
                        <th className="text-left p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows.map((row, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="p-2">{row['Reg Number']}</td>
                          <td className="p-2">{row['Name']}</td>
                          <td className="p-2">{row['Dept']}</td>
                          <td className="p-2">{row['PI']}</td>
                          <td className="p-2">{row['CGPA']}</td>
                          <td className="p-2">{row['Maximum Salary']}</td>
                          <td className="p-2">{row['Placed or Non Placed']}</td>
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
              <Card>
                <CardHeader><CardTitle>Placed vs Non-Placed</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie dataKey="value" data={metrics.placedDonut} cx="50%" cy="50%" innerRadius={60} outerRadius={100} label>
                        {metrics.placedDonut.map((_, idx) => (<Cell key={idx} fill={COLORS[idx % COLORS.length]} />))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>CGPA vs Maximum Salary</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <ScatterChart>
                      <CartesianGrid />
                      <XAxis dataKey="x" name="CGPA" />
                      <YAxis dataKey="y" name="Salary" />
                      <Tooltip />
                      <Scatter data={metrics.cgpaVsSalary} fill="#3b82f6" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>10th & 12th Marks vs Placement</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={metrics.marksVsPlaced}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="key" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="placed" stackId="a" fill="#10b981" />
                      <Bar dataKey="not" stackId="a" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Cutoff vs Companies Placed</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={metrics.cutoffVsCompanies}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="cutoff" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="companies" stroke="#3b82f6" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Company-wise Student Count</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={metrics.companyCount}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="company" interval={0} angle={-25} textAnchor="end" height={60} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Top 5 Companies by Avg Salary</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={metrics.topCompaniesByAvg}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="company" interval={0} angle={-25} textAnchor="end" height={60} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="avg" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Offers per Student (Histogram)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={metrics.offersHistogram}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="offers" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#06b6d4" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Organized By (Drive Split)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie dataKey="count" data={metrics.organizedTrend} cx="50%" cy="50%" outerRadius={100} label>
                        {metrics.organizedTrend.map((_, idx) => (<Cell key={idx} fill={COLORS[idx % COLORS.length]} />))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Single vs Multiple Offers</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie dataKey="value" data={metrics.singleVsMulti} cx="50%" cy="50%" outerRadius={100} label>
                        {metrics.singleVsMulti.map((_, idx) => (<Cell key={idx} fill={COLORS[idx % COLORS.length]} />))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Dept-wise Placement %</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={metrics.deptPct}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="dept" interval={0} angle={-25} textAnchor="end" height={60} />
                      <YAxis domain={[0,100]} />
                      <Tooltip />
                      <Bar dataKey="pct" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Section-wise Placement</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={metrics.sectionCompare}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="section" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="placed" fill="#3b82f6" />
                      <Line type="monotone" dataKey="total" stroke="#94a3b8" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

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

              <Card>
                <CardHeader><CardTitle>Gender-wise Placement Ratio</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie dataKey="value" data={metrics.genderRatio} cx="50%" cy="50%" outerRadius={100} label>
                        {metrics.genderRatio.map((_, idx) => (<Cell key={idx} fill={COLORS[idx % COLORS.length]} />))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Quota-based Placement</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie dataKey="value" data={metrics.quotaDonut} cx="50%" cy="50%" outerRadius={100} label>
                        {metrics.quotaDonut.map((_, idx) => (<Cell key={idx} fill={COLORS[idx % COLORS.length]} />))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Quota vs Maximum Salary</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={metrics.quotaVsMax}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="quota" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="max" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Hosteller vs Day Scholar Placement %</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={metrics.hostelPct}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" />
                      <YAxis domain={[0,100]} />
                      <Tooltip />
                      <Bar dataKey="pct" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Hosteller vs Day Scholar Avg Package</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={metrics.hostelAvg}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="avg" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Maximum Salary by Dept</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={metrics.maxSalaryByDept}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="dept" interval={0} angle={-25} textAnchor="end" height={60} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="max" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Average Salary by Section</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={metrics.avgSalaryBySection}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="section" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="avg" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Salary Range Distribution</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={metrics.salaryHistogram}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#06b6d4" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Top 10 Students by Salary</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={metrics.top10Students}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" interval={0} angle={-25} textAnchor="end" height={60} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="pkg" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Students Placed in 2+, 3+, 5+</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={metrics.placedThresholds}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="threshold" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Company Joined vs Highest Package</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <ScatterChart>
                      <CartesianGrid />
                      <XAxis dataKey="x" name="Company" interval={0} />
                      <YAxis dataKey="y" name="Highest Package" />
                      <Tooltip />
                      <Scatter data={metrics.companyVsHighest} fill="#ef4444" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Placement Drive Success (Organized By)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={metrics.organizedTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="org" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#3b82f6" />
                    </LineChart>
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
              Upload an Excel file to start analyzing student data
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

export default CareerStudents;
