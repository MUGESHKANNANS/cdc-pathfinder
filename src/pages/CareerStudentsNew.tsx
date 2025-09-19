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
                <CardHeader>
                  <CardTitle>Placement Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-primary mb-2">
                      {filteredRows.length > 0 ? 
                        Math.round((filteredRows.filter(r => String(r['Placed or Non Placed'] || '').toLowerCase().includes('placed')).length / filteredRows.length) * 100) : 0}%
                    </div>
                    <p className="text-muted-foreground">Overall Placement Rate</p>
                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="font-semibold">Total Students</div>
                        <div>{filteredRows.length}</div>
                      </div>
                      <div>
                        <div className="font-semibold">Placed Students</div>
                        <div>{filteredRows.filter(r => String(r['Placed or Non Placed'] || '').toLowerCase().includes('placed')).length}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Department Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={deptOptions.map(dept => ({
                          name: dept,
                          value: filteredRows.filter(r => r.Dept === dept).length
                        }))}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="value"
                      >
                        {deptOptions.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
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
