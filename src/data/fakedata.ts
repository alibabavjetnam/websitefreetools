/** Bộ dữ liệu giả theo từng nước cho công cụ fake-data (tên, địa chỉ là ví dụ phổ biến, không phải người thật) */
export interface FakeLocale { first: string[]; last: string[]; order: 'fl' | 'lf'; cities: string[]; streets: string[]; phone: string; company: string[]; domain: string[]; tld: string }
export const FAKE: Record<string, FakeLocale> = {
  vi: {
    first: 'An,Bình,Chi,Dũng,Giang,Hà,Hải,Hạnh,Hiếu,Hoa,Hùng,Hương,Khang,Khánh,Lan,Linh,Long,Mai,Minh,Nam,Ngọc,Nhung,Phong,Phúc,Quân,Quỳnh,Sơn,Tâm,Thảo,Thành,Trang,Trung,Tú,Tuấn,Uyên,Việt,Vy,Yến'.split(','),
    last: 'Nguyễn Văn,Trần Thị,Lê Minh,Phạm Thu,Hoàng Đức,Huỳnh Ngọc,Phan Thanh,Vũ Hoài,Võ Quốc,Đặng Thuỳ,Bùi Gia,Đỗ Khánh,Hồ Bảo,Ngô Phương,Dương Hải,Lý Tuấn'.split(','),
    order: 'lf', cities: 'Hà Nội,TP. Hồ Chí Minh,Đà Nẵng,Hải Phòng,Cần Thơ,Huế,Nha Trang,Quảng Ngãi,Vũng Tàu,Đà Lạt,Biên Hoà,Vinh'.split(','),
    streets: 'Lê Lợi,Nguyễn Huệ,Trần Hưng Đạo,Hai Bà Trưng,Lý Thường Kiệt,Phan Chu Trinh,Quang Trung,Điện Biên Phủ,Hùng Vương,Nguyễn Trãi'.split(','),
    phone: '09########', company: 'Công ty TNHH Ánh Dương,Công ty CP Sao Việt,Công ty TNHH Phú Gia,Công ty CP Minh Long,Công ty TNHH Hoa Sen Xanh'.split(','), domain: 'gmail.com,yahoo.com.vn,outlook.com'.split(','), tld: 'vn',
  },
  en: {
    first: 'James,Mary,John,Patricia,Robert,Jennifer,Michael,Linda,William,Elizabeth,David,Susan,Richard,Jessica,Joseph,Sarah,Thomas,Karen,Daniel,Emily,Matthew,Olivia,Anthony,Emma,Mark,Ava'.split(','),
    last: 'Smith,Johnson,Williams,Brown,Jones,Garcia,Miller,Davis,Rodriguez,Martinez,Wilson,Anderson,Taylor,Thomas,Moore,Jackson,Martin,Lee,Thompson,White'.split(','),
    order: 'fl', cities: 'New York,Los Angeles,Chicago,Houston,Phoenix,Philadelphia,San Antonio,San Diego,Dallas,Austin,Seattle,Denver,Boston'.split(','),
    streets: 'Main St,Oak Ave,Maple Dr,Cedar Ln,Elm St,Pine Rd,Washington Blvd,Lake View Dr,Park Ave,Sunset Blvd'.split(','),
    phone: '(###) ###-####', company: 'Acme Corp,Blue Ridge LLC,Summit Partners,Northwind Traders,Bright Path Inc'.split(','), domain: 'gmail.com,yahoo.com,outlook.com'.split(','), tld: 'com',
  },
  ja: {
    first: '翔太,陽菜,蓮,結衣,大翔,美咲,悠真,さくら,湊,葵,颯太,凛,健太,花子,太郎,愛'.split(','),
    last: '佐藤,鈴木,高橋,田中,伊藤,渡辺,山本,中村,小林,加藤,吉田,山田'.split(','),
    order: 'lf', cities: '東京都新宿区,大阪市北区,横浜市中区,名古屋市中村区,札幌市中央区,福岡市博多区,京都市下京区,神戸市中央区'.split(','),
    streets: '1-2-3,2-5-8,3-1-14,4-7-2,5-3-9'.split(','),
    phone: '090-####-####', company: '株式会社さくら商事,山田工業株式会社,株式会社ひかりソフト,青葉物産株式会社'.split(','), domain: 'gmail.com,yahoo.co.jp,docomo.ne.jp'.split(','), tld: 'jp',
  },
  zh: {
    first: '伟,芳,娜,敏,静,磊,强,洋,艳,杰,婷,涛,明,超,秀英,浩然'.split(','),
    last: '王,李,张,刘,陈,杨,赵,黄,周,吴,徐,孙'.split(','),
    order: 'lf', cities: '北京市朝阳区,上海市浦东新区,广州市天河区,深圳市南山区,杭州市西湖区,成都市武侯区,南京市鼓楼区,武汉市江汉区'.split(','),
    streets: '人民路,建设路,中山路,解放路,长江路,和平路,新华路'.split(','),
    phone: '13#########', company: '华星科技有限公司,东方贸易有限公司,长城实业有限公司,蓝天网络科技有限公司'.split(','), domain: 'qq.com,163.com,126.com'.split(','), tld: 'cn',
  },
  es: {
    first: 'Lucía,Hugo,Martina,Mateo,Sofía,Pablo,Valeria,Daniel,Carmen,Javier,Elena,Alejandro,Paula,Diego'.split(','),
    last: 'García,Rodríguez,González,Fernández,López,Martínez,Sánchez,Pérez,Gómez,Martín,Jiménez,Ruiz'.split(','),
    order: 'fl', cities: 'Madrid,Barcelona,Valencia,Sevilla,Zaragoza,Málaga,Bilbao,Granada'.split(','),
    streets: 'Calle Mayor,Gran Vía,Calle del Sol,Avenida de la Paz,Calle Real,Paseo del Prado'.split(','),
    phone: '6## ### ###', company: 'Soluciones Ibéricas SL,Grupo Horizonte SA,Tecnologías del Sur SL'.split(','), domain: 'gmail.com,hotmail.es,yahoo.es'.split(','), tld: 'es',
  },
  de: {
    first: 'Lukas,Mia,Leon,Emma,Finn,Hannah,Paul,Sophie,Jonas,Lena,Felix,Anna,Max,Laura'.split(','),
    last: 'Müller,Schmidt,Schneider,Fischer,Weber,Meyer,Wagner,Becker,Schulz,Hoffmann,Koch,Richter'.split(','),
    order: 'fl', cities: 'Berlin,Hamburg,München,Köln,Frankfurt am Main,Stuttgart,Düsseldorf,Leipzig'.split(','),
    streets: 'Hauptstraße,Schulstraße,Gartenstraße,Bahnhofstraße,Dorfstraße,Lindenweg'.split(','),
    phone: '0151 ########', company: 'Nordlicht GmbH,Becker & Söhne KG,Alpen Technik AG,Rheinwerk GmbH'.split(','), domain: 'gmail.com,web.de,gmx.de'.split(','), tld: 'de',
  },
};
