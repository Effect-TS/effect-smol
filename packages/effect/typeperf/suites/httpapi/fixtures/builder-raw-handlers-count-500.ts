// Measures chained builder handleRaw registration for 500 same-shaped endpoints in one group.
import { Effect, Schema } from "effect"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"

Schema.String
HttpApi.make("Api")
HttpApiGroup.make("users")
HttpApiEndpoint.get("warmup", "/warmup")

const Params = Schema.Struct({
  id: Schema.FiniteFromString
})

const User = Schema.Struct({
  id: Schema.String,
  name: Schema.String
})

const group = HttpApiGroup.make("users").add(
  HttpApiEndpoint.get("getUser0001", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0002", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0003", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0004", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0005", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0006", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0007", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0008", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0009", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0010", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0011", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0012", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0013", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0014", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0015", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0016", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0017", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0018", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0019", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0020", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0021", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0022", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0023", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0024", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0025", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0026", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0027", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0028", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0029", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0030", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0031", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0032", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0033", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0034", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0035", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0036", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0037", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0038", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0039", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0040", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0041", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0042", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0043", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0044", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0045", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0046", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0047", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0048", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0049", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0050", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0051", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0052", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0053", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0054", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0055", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0056", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0057", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0058", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0059", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0060", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0061", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0062", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0063", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0064", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0065", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0066", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0067", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0068", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0069", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0070", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0071", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0072", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0073", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0074", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0075", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0076", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0077", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0078", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0079", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0080", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0081", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0082", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0083", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0084", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0085", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0086", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0087", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0088", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0089", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0090", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0091", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0092", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0093", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0094", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0095", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0096", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0097", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0098", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0099", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0100", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0101", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0102", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0103", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0104", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0105", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0106", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0107", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0108", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0109", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0110", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0111", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0112", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0113", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0114", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0115", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0116", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0117", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0118", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0119", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0120", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0121", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0122", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0123", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0124", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0125", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0126", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0127", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0128", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0129", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0130", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0131", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0132", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0133", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0134", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0135", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0136", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0137", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0138", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0139", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0140", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0141", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0142", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0143", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0144", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0145", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0146", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0147", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0148", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0149", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0150", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0151", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0152", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0153", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0154", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0155", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0156", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0157", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0158", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0159", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0160", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0161", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0162", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0163", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0164", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0165", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0166", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0167", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0168", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0169", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0170", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0171", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0172", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0173", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0174", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0175", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0176", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0177", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0178", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0179", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0180", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0181", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0182", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0183", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0184", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0185", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0186", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0187", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0188", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0189", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0190", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0191", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0192", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0193", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0194", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0195", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0196", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0197", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0198", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0199", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0200", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0201", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0202", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0203", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0204", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0205", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0206", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0207", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0208", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0209", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0210", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0211", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0212", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0213", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0214", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0215", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0216", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0217", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0218", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0219", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0220", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0221", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0222", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0223", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0224", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0225", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0226", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0227", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0228", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0229", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0230", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0231", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0232", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0233", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0234", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0235", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0236", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0237", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0238", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0239", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0240", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0241", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0242", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0243", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0244", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0245", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0246", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0247", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0248", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0249", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0250", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0251", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0252", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0253", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0254", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0255", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0256", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0257", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0258", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0259", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0260", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0261", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0262", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0263", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0264", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0265", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0266", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0267", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0268", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0269", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0270", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0271", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0272", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0273", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0274", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0275", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0276", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0277", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0278", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0279", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0280", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0281", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0282", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0283", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0284", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0285", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0286", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0287", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0288", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0289", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0290", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0291", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0292", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0293", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0294", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0295", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0296", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0297", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0298", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0299", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0300", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0301", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0302", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0303", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0304", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0305", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0306", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0307", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0308", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0309", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0310", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0311", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0312", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0313", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0314", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0315", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0316", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0317", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0318", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0319", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0320", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0321", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0322", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0323", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0324", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0325", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0326", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0327", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0328", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0329", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0330", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0331", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0332", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0333", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0334", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0335", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0336", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0337", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0338", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0339", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0340", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0341", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0342", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0343", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0344", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0345", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0346", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0347", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0348", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0349", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0350", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0351", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0352", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0353", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0354", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0355", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0356", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0357", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0358", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0359", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0360", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0361", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0362", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0363", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0364", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0365", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0366", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0367", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0368", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0369", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0370", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0371", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0372", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0373", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0374", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0375", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0376", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0377", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0378", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0379", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0380", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0381", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0382", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0383", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0384", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0385", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0386", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0387", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0388", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0389", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0390", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0391", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0392", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0393", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0394", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0395", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0396", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0397", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0398", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0399", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0400", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0401", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0402", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0403", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0404", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0405", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0406", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0407", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0408", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0409", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0410", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0411", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0412", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0413", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0414", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0415", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0416", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0417", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0418", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0419", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0420", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0421", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0422", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0423", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0424", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0425", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0426", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0427", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0428", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0429", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0430", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0431", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0432", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0433", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0434", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0435", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0436", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0437", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0438", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0439", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0440", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0441", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0442", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0443", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0444", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0445", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0446", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0447", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0448", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0449", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0450", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0451", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0452", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0453", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0454", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0455", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0456", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0457", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0458", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0459", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0460", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0461", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0462", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0463", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0464", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0465", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0466", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0467", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0468", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0469", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0470", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0471", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0472", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0473", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0474", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0475", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0476", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0477", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0478", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0479", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0480", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0481", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0482", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0483", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0484", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0485", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0486", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0487", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0488", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0489", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0490", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0491", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0492", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0493", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0494", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0495", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0496", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0497", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0498", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0499", "/users/:id", {
    params: Params,
    success: User
  }),
  HttpApiEndpoint.get("getUser0500", "/users/:id", {
    params: Params,
    success: User
  })
)

const api = HttpApi.make("Api").add(group)

export const layer = HttpApiBuilder.group(api, "users", (handlers) =>
  handlers
    .handleRaw("getUser0001", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0002", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0003", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0004", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0005", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0006", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0007", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0008", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0009", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0010", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0011", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0012", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0013", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0014", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0015", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0016", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0017", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0018", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0019", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0020", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0021", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0022", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0023", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0024", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0025", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0026", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0027", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0028", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0029", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0030", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0031", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0032", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0033", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0034", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0035", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0036", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0037", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0038", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0039", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0040", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0041", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0042", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0043", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0044", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0045", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0046", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0047", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0048", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0049", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0050", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0051", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0052", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0053", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0054", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0055", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0056", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0057", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0058", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0059", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0060", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0061", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0062", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0063", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0064", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0065", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0066", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0067", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0068", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0069", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0070", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0071", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0072", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0073", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0074", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0075", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0076", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0077", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0078", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0079", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0080", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0081", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0082", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0083", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0084", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0085", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0086", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0087", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0088", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0089", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0090", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0091", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0092", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0093", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0094", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0095", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0096", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0097", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0098", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0099", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0100", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0101", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0102", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0103", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0104", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0105", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0106", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0107", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0108", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0109", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0110", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0111", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0112", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0113", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0114", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0115", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0116", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0117", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0118", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0119", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0120", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0121", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0122", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0123", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0124", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0125", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0126", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0127", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0128", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0129", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0130", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0131", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0132", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0133", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0134", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0135", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0136", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0137", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0138", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0139", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0140", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0141", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0142", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0143", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0144", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0145", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0146", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0147", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0148", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0149", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0150", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0151", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0152", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0153", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0154", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0155", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0156", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0157", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0158", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0159", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0160", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0161", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0162", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0163", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0164", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0165", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0166", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0167", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0168", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0169", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0170", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0171", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0172", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0173", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0174", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0175", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0176", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0177", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0178", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0179", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0180", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0181", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0182", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0183", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0184", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0185", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0186", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0187", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0188", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0189", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0190", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0191", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0192", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0193", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0194", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0195", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0196", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0197", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0198", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0199", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0200", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0201", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0202", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0203", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0204", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0205", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0206", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0207", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0208", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0209", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0210", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0211", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0212", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0213", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0214", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0215", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0216", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0217", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0218", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0219", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0220", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0221", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0222", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0223", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0224", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0225", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0226", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0227", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0228", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0229", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0230", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0231", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0232", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0233", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0234", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0235", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0236", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0237", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0238", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0239", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0240", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0241", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0242", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0243", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0244", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0245", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0246", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0247", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0248", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0249", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0250", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0251", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0252", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0253", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0254", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0255", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0256", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0257", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0258", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0259", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0260", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0261", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0262", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0263", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0264", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0265", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0266", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0267", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0268", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0269", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0270", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0271", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0272", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0273", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0274", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0275", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0276", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0277", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0278", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0279", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0280", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0281", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0282", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0283", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0284", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0285", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0286", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0287", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0288", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0289", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0290", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0291", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0292", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0293", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0294", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0295", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0296", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0297", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0298", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0299", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0300", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0301", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0302", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0303", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0304", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0305", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0306", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0307", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0308", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0309", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0310", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0311", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0312", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0313", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0314", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0315", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0316", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0317", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0318", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0319", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0320", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0321", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0322", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0323", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0324", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0325", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0326", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0327", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0328", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0329", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0330", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0331", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0332", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0333", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0334", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0335", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0336", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0337", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0338", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0339", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0340", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0341", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0342", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0343", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0344", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0345", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0346", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0347", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0348", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0349", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0350", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0351", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0352", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0353", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0354", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0355", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0356", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0357", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0358", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0359", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0360", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0361", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0362", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0363", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0364", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0365", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0366", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0367", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0368", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0369", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0370", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0371", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0372", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0373", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0374", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0375", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0376", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0377", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0378", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0379", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0380", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0381", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0382", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0383", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0384", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0385", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0386", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0387", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0388", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0389", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0390", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0391", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0392", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0393", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0394", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0395", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0396", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0397", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0398", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0399", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0400", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0401", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0402", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0403", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0404", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0405", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0406", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0407", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0408", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0409", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0410", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0411", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0412", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0413", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0414", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0415", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0416", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0417", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0418", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0419", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0420", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0421", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0422", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0423", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0424", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0425", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0426", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0427", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0428", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0429", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0430", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0431", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0432", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0433", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0434", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0435", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0436", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0437", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0438", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0439", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0440", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0441", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0442", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0443", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0444", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0445", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0446", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0447", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0448", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0449", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0450", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0451", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0452", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0453", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0454", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0455", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0456", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0457", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0458", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0459", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0460", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0461", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0462", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0463", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0464", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0465", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0466", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0467", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0468", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0469", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0470", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0471", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0472", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0473", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0474", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0475", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0476", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0477", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0478", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0479", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0480", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0481", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0482", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0483", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0484", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0485", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0486", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0487", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0488", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0489", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0490", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0491", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0492", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0493", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0494", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0495", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0496", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0497", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0498", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0499", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      }))
    .handleRaw("getUser0500", ({ params }) =>
      Effect.succeed({
        id: String(params.id),
        name: "Ada"
      })))

export type Layer = typeof layer
export type Handlers = HttpApiBuilder.Handlers.FromGroup<typeof group>
