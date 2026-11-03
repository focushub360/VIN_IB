type Rc = Record<string, any>;
const rows: Rc[] = [];
const newRows = rows.map((r, i) => ({
    ...r,
    __idx: i,
    __autoVerbatim: new Set<string>(r.__autoVerbatim instanceof Set ? Array.from(r.__autoVerbatim) : [])
}));
newRows.forEach((r, rowIdx) => {
    const c = 'DF';
    const d = r[c];
    console.log(d, rowIdx);
});
