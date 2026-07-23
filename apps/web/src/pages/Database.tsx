import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useListPersons, useEnrollPerson, useDeletePerson, getListPersonsQueryKey } from '@workspace/api-client-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { fileToBase64 } from '@/lib/file-utils';

export default function Database() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isEnrollOpen, setIsEnrollOpen] = useState(false);

  const { data, isLoading } = useListPersons(
    { page, limit: 10, search: search || undefined },
    { query: { queryKey: getListPersonsQueryKey({ page, limit: 10, search: search || undefined }) } }
  );

  const enroll = useEnrollPerson();
  const deletePerson = useDeletePerson();

  const [enrollData, setEnrollData] = useState({ name: '', nameAr: '', source: 'manual' });
  const [enrollFile, setEnrollFile] = useState<File | null>(null);

  const handleEnroll = async () => {
    if (!enrollData.name) { toast.error('Name is required'); return; }
    let imageBase64 = null;
    if (enrollFile) {
      try {
        imageBase64 = await fileToBase64(enrollFile);
      } catch (e) {
        toast.error('Failed to read feature map');
        return;
      }
    }
    enroll.mutate({ data: { ...enrollData, imageBase64 } }, {
      onSuccess: () => {
        toast.success('Subject enrolled successfully');
        setIsEnrollOpen(false);
        setEnrollData({ name: '', nameAr: '', source: 'manual' });
        setEnrollFile(null);
        queryClient.invalidateQueries({ queryKey: getListPersonsQueryKey() });
      },
      onError: () => toast.error('Enrollment sequence failed')
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm('Purge subject from database? This action cannot be undone.')) return;
    deletePerson.mutate({ id }, {
      onSuccess: () => {
        toast.success('Subject data purged');
        queryClient.invalidateQueries({ queryKey: getListPersonsQueryKey() });
      },
      onError: () => toast.error('Purge sequence failed')
    });
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-mono font-bold text-primary uppercase tracking-widest">{t('db.title')}</h1>
          <p className="text-muted-foreground font-mono text-sm">{t('db.subtitle')}</p>
        </div>

        <Dialog open={isEnrollOpen} onOpenChange={setIsEnrollOpen}>
          <DialogTrigger asChild>
            <Button>{t('db.enroll')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('db.enroll_title')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('db.name')}</Label>
                <Input value={enrollData.name} onChange={e => setEnrollData(d => ({...d, name: e.target.value}))} placeholder="JOHN DOE" />
              </div>
              <div className="space-y-2">
                <Label>{t('db.name_ar')}</Label>
                <Input value={enrollData.nameAr} onChange={e => setEnrollData(d => ({...d, nameAr: e.target.value}))} dir="rtl" placeholder="جون دو" />
              </div>
              <div className="space-y-2">
                <Label>Primary Feature Map (Image)</Label>
                <Input type="file" accept="image/*" onChange={e => setEnrollFile(e.target.files?.[0] || null)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsEnrollOpen(false)}>{t('db.cancel')}</Button>
              <Button onClick={handleEnroll} disabled={enroll.isPending}>{t('db.submit')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="flex-1">
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle>Subject Registry</CardTitle>
          <div className="w-64">
            <Input placeholder={t('db.search')} value={search} onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
                <TableHead className="w-16">MAP</TableHead>
                <TableHead>IDENTIFIER</TableHead>
                <TableHead>{t('db.source')}</TableHead>
                <TableHead>{t('db.faces')}</TableHead>
                <TableHead>{t('db.enrolled_at')}</TableHead>
                <TableHead className="text-right">{t('db.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({length: 5}).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}><div className="h-8 bg-muted/30 animate-pulse"></div></TableCell>
                  </TableRow>
                ))
              ) : data?.persons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">NO SUBJECTS FOUND</TableCell>
                </TableRow>
              ) : data?.persons.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-muted-foreground">{p.id.toString().padStart(4, '0')}</TableCell>
                  <TableCell>
                    {p.thumbnailUrl ? (
                      <img src={p.thumbnailUrl} alt={p.name} className="w-8 h-8 object-cover border border-primary/30 grayscale hover:grayscale-0 transition-all" />
                    ) : (
                      <div className="w-8 h-8 bg-muted flex items-center justify-center text-xs font-mono border border-border text-muted-foreground">?</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-primary uppercase">{p.name}</div>
                    {p.nameAr && <div className="text-xs text-muted-foreground font-sans">{p.nameAr}</div>}
                  </TableCell>
                  <TableCell><Badge variant="outline">{p.source}</Badge></TableCell>
                  <TableCell className="font-mono">{p.faceCount}</TableCell>
                  <TableCell className="font-mono text-xs">{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="danger" className="h-8 text-xs px-2" onClick={() => handleDelete(p.id)}>PURGE</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data && (
            <div className="mt-4 flex justify-between items-center font-mono text-sm text-muted-foreground border-t border-border/50 pt-4">
              <div>TOTAL: {data.total} ENTITIES</div>
              <div className="space-x-2">
                <Button variant="outline" className="h-8" disabled={page === 1} onClick={() => setPage(p => p-1)}>PREV</Button>
                <span className="px-2 text-primary">{page}</span>
                <Button variant="outline" className="h-8" disabled={data.persons.length < data.limit} onClick={() => setPage(p => p+1)}>NEXT</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
