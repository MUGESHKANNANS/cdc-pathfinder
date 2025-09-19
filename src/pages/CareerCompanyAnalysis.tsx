import React, { useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Tooltip, ResponsiveContainer } from 'recharts';
import { downloadNodeAsPng } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Download, Upload, FileSpreadsheet, BarChart3, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import jsPDF from 'jspdf';

const TEMPLATE_HEADERS = [
  'S.No','Company Name','Package','Organized','AD','AIML','BME','CSBS','CHEM','CIVIL','CSE','ECE','EEE','IT','MCT','MECH','Total'
];

const normalize = (s: string) => s?.trim().replace(/\s+/g, ' ').replace(/\u00A0/g, ' ');
const toNumber = (v: any): number => {
  const n = Number(String(v ?? '').toString().replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

interface RowData { [key: string]: any }

const CareerCompanyAnalysis: React.FC = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<RowData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // Filters
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [organizerFilter, setOrganizerFilter] = useState<string>('all');
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
    XLSX.writeFile(wb, 'company_analysis_template.xlsx');
  };

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

      if (!data.length) {
        toast({ title: 'No data', description: 'The file appears to be empty', variant: 'destructive' });
        return;
      }

      setRows(data);
      setHeaders(Object.keys(data[0] || {}));
      setCurrentPage(1);
      console.log('Company data loaded:', data.length, 'records');
      console.log('Sample record:', data[0]);
      console.log('Headers:', Object.keys(data[0] || {}));
      toast({ title: 'Success', description: `Loaded ${data.length} companies` });
    } catch (e: any) {
      toast({ title: 'Parse error', description: e.message || 'Failed to parse file', variant: 'destructive' });
    }
  };

  // Enhanced filtering logic
  const filteredRows = useMemo(() => {
    const s = search.toLowerCase();
    return rows.filter(r => {
      const matchesSearch = s ? String(r['Company Name']||'').toLowerCase().includes(s) : true;
      const matchesCompany = companyFilter === 'all' ? true : String(r['Company Name']||'') === companyFilter;
      const matchesOrganizer = organizerFilter === 'all' ? true : String(r['Organized']||'') === organizerFilter;
      const pkg = toNumber(r['Package']);
      const packageMatch = (!packageMin || pkg >= toNumber(packageMin)) && (!packageMax || pkg <= toNumber(packageMax));
      return matchesSearch && matchesCompany && matchesOrganizer && packageMatch;
    });
  }, [rows, search, companyFilter, organizerFilter, packageMin, packageMax]);

  // Pagination
  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
  const paginatedRows = filteredRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Export functions
  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Company Analysis');
    XLSX.writeFile(wb, 'company_analysis_export.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('Career Company Analysis Report', 20, 20);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30);
    doc.text(`Total Records: ${filteredRows.length}`, 20, 40);
    doc.save('company_analysis_report.pdf');
  };

  const resetFilters = () => {
    setSearch('');
    setCompanyFilter('all');
    setOrganizerFilter('all');
    setPackageMin('');
    setPackageMax('');
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  // Detect department columns dynamically (all headers between Company/Package/Organized and Total)
  const allHeaders = useMemo(() => Object.keys(rows[0] || {}), [rows]);
  const departments = useMemo(() => {
    const exclude = new Set(['S.No','Company Name','Package','Organized','Total']);
    return allHeaders.filter(h => !exclude.has(h));
  }, [allHeaders]);

  const companies = useMemo(() => Array.from(new Set(rows.map(r => String(r['Company Name'] || 'NA')))), [rows]);
  const organizers = useMemo(() => Array.from(new Set(rows.map(r => String(r['Organized'] || 'NA')))), [rows]);

  const metrics = useMemo(() => {
    // Company totals by department and overall
    const perCompany = filteredRows.map(r => {
      const company = String(r['Company Name'] || 'NA');
      const pkg = Number(r['Package']) || 0;
      const organized = String(r['Organized'] || 'NA');
      const deptCounts = departments.map(d => Number(r[d]) || 0);
      const total = Number(r['Total']) || deptCounts.reduce((a,b)=>a+b,0);
      return { company, pkg, organized, total, depts: Object.fromEntries(departments.map((d,i)=>[d, deptCounts[i]])) };
    });

    // Top companies by hires
    const topCompanies = [...perCompany].sort((a,b)=>b.total-a.total).slice(0, 15).map(x=>({ company: x.company, hires: x.total }));

    // Package distribution
    const pkgBuckets = new Map<string, number>();
    perCompany.forEach(c => {
      const v = c.pkg; if (!Number.isFinite(v)) return; const start = Math.floor(v/1)*1; const end = start+1; const k = `${start}-${end}`; pkgBuckets.set(k, (pkgBuckets.get(k)||0)+1);
    });
    const packageDist = Array.from(pkgBuckets.entries()).sort((a,b)=>Number(a[0].split('-')[0])-Number(b[0].split('-')[0])).map(([range,count])=>({ range, count }));

    // Organized by split
    const orgMap = new Map<string, number>();
    perCompany.forEach(c => { orgMap.set(c.organized, (orgMap.get(c.organized)||0)+1); });
    const organizedSplit = Array.from(orgMap.entries()).map(([organized, value])=>({ organized, value }));

    // Department totals
    const deptTotals = departments.map(d => ({ dept: d, hires: perCompany.reduce((sum,c)=>sum + (c.depts[d]||0), 0) }));

    // Company x Dept (stacked)
    const companyDept = perCompany.slice(0, 10).map(c => ({ company: c.company, ...c.depts }));

    // Dept share per company (percentage)
    const deptSharePerCompany = perCompany.slice(0, 10).map(c => {
      const row: any = { company: c.company };
      departments.forEach(d => { row[d] = c.total ? Math.round(((c.depts[d]||0) / c.total) * 100) : 0; });
      return row;
    });

    // Cumulative hires over companies (sorted by total)
    const sorted = [...perCompany].sort((a,b)=>b.total-a.total);
    const cumulative = sorted.map((c, idx) => ({ idx: idx+1, cumulative: sorted.slice(0, idx+1).reduce((s,x)=>s+x.total,0) }));

    // Top departments per company (category)
    const topDeptPerCompany = perCompany.slice(0, 10).map(c => {
      const entries = Object.entries(c.depts) as [string, number][];
      const [dept, hires] = entries.sort((a,b)=>b[1]-a[1])[0] || ['NA', 0];
      return { company: c.company, dept, hires };
    });

    // Average package by organizer
    const orgToPkg = new Map<string, { sum: number; count: number }>();
    perCompany.forEach(c => { const o = c.organized; const cur = orgToPkg.get(o)||{sum:0,count:0}; if(Number.isFinite(c.pkg)){ cur.sum+=c.pkg; cur.count++; } orgToPkg.set(o, cur); });
    const avgPackageByOrganizer = Array.from(orgToPkg.entries()).map(([organized, v])=>({ organized, avg: v.count ? Math.round(v.sum/v.count) : 0 }));

    // Company-wise average package (bar)
    const avgPackageByCompany = perCompany.map(c => ({ company: c.company, avg: c.pkg }));

    // Company-wise total placed (pie)
    const companyTotalsPie = perCompany.slice(0, 12).map(c => ({ name: c.company, value: c.total }));

    // Dept-wise top 3 hiring companies
    const deptTop3 = departments.slice(0, 8).map(d => {
      const list = perCompany.map(c => ({ company: c.company, hires: c.depts[d] || 0 })).sort((a,b)=>b.hires-a.hires).slice(0,3);
      return { dept: d, c1: list[0]?.hires||0, c2: list[1]?.hires||0, c3: list[2]?.hires||0, n1: list[0]?.company||'', n2: list[1]?.company||'', n3: list[2]?.company||'' };
    });

    // Heatmap table data (company vs dept)
    const heatmap = perCompany.slice(0, 12).map(c => ({ company: c.company, ...c.depts }));

    // Top 5 companies by package
    const top5ByPackage = [...perCompany].sort((a,b)=>b.pkg-a.pkg).slice(0,5).map(x=>({ company: x.company, pkg: x.pkg }));

    // Organizer drive count per company (occurrence count)
    const companyDriveCountMap = new Map<string, number>();
    filteredRows.forEach(r => { const c = String(r['Company Name']||'NA'); companyDriveCountMap.set(c, (companyDriveCountMap.get(c)||0)+1); });
    const companyDriveCount = Array.from(companyDriveCountMap.entries()).map(([company, count])=>({ company, count }));

    // Overall placement contribution by company (donut)
    const contribution = companyTotalsPie;

    // Multi-year trend if Batch or Year exists
    const hasBatch = allHeaders.includes('Batch') || allHeaders.includes('Year');
    const batchKey = allHeaders.includes('Batch') ? 'Batch' : (allHeaders.includes('Year') ? 'Year' : '');
    const companyBatchTrend = hasBatch ? (() => {
      const mb = new Map<string, Map<string, number>>();
      filteredRows.forEach(r => { const c = String(r['Company Name']||'NA'); const b = String(r[batchKey]||'NA'); const val = Number(r['Total'])||0; const m = mb.get(c)||new Map(); m.set(b, (m.get(b)||0)+val); mb.set(c, m); });
      const top = [...perCompany].sort((a,b)=>b.total-a.total).slice(0,5).map(c=>c.company);
      const batches = Array.from(new Set(filteredRows.map(r=>String(r[batchKey]||'NA'))));
      return top.map(company => ({ company, ...Object.fromEntries(batches.map(b=>[b, mb.get(company)?.get(b)||0])) }));
    })() : [];

    // Dept-wise highest package company (table rows)
    const deptHighestPackage = departments.map(d => {
      const eligible = perCompany.filter(c => (c.depts[d]||0) > 0);
      const best = eligible.sort((a,b)=>b.pkg-a.pkg)[0];
      return { dept: d, company: best?.company || 'NA', pkg: best?.pkg || 0 };
    });

    // Bubble: company vs package range (x: pkg, y: total, z: depts>0)
    const bubbleData = perCompany.map(c => ({ x: c.pkg, y: c.total, z: Object.values(c.depts).filter((v:any)=>Number(v)>0).length, company: c.company }));

    // Top 10 combined: stacked depts + line for package
    const top10 = [...perCompany].sort((a,b)=>b.total-a.total).slice(0,10);
    const top10Combined = top10.map(c => ({ company: c.company, pkg: c.pkg, ...c.depts }));

    return { perCompany, topCompanies, packageDist, organizedSplit, deptTotals, companyDept, deptSharePerCompany, cumulative, topDeptPerCompany, avgPackageByOrganizer,
      avgPackageByCompany, companyTotalsPie, deptTop3, heatmap, top5ByPackage, companyDriveCount, contribution, companyBatchTrend, deptHighestPackage, bubbleData, top10Combined };
  }, [filteredRows, departments, allHeaders]);

  const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#22c55e', '#eab308'];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Career - Company Wise Analysis</h1>
          <p className="text-muted-foreground">Upload Excel/CSV and view company-wise insights</p>
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
        onChange={onFileChange}
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
                    <Label htmlFor="company">Company</Label>
                    <Select value={companyFilter} onValueChange={setCompanyFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Companies" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Companies</SelectItem>
                        {companies.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="organizer">Organizer</Label>
                    <Select value={organizerFilter} onValueChange={setOrganizerFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Organizers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Organizers</SelectItem>
                        {organizers.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
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
                <CardTitle>Company Analysis Data</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        {headers.map((h) => (
                          <th key={h} className="text-left p-2 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows.map((row, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          {headers.map((h) => (
                            <td key={h} className="p-2 text-sm">
                              {row[h] || '-'}
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
            {/* All existing visualizations will be moved here */}
          </TabsContent>
        </Tabs>
      )}

      {rows.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <FileSpreadsheet className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Data Uploaded</h3>
            <p className="text-muted-foreground mb-4">
              Upload an Excel file to start analyzing company data
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

export default CareerCompanyAnalysis; 