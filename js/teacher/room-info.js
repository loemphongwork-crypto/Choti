// ข้อมูลห้องที่จำไว้ในเครื่อง (ชื่อห้อง วิชา รายชื่อ · มีคาบเปิดอยู่ไหม)
export function roomInfo(d) {
  return { classroom: d.classroom, course: d.course, students: d.students, session: d.session ? { id: d.session.id } : null };
}
