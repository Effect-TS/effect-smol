// Measures class-like endpoint declaration for 100 same-shaped endpoints.
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"

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

class GetUser0001 extends HttpApiEndpoint.get("getUser0001", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0002 extends HttpApiEndpoint.get("getUser0002", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0003 extends HttpApiEndpoint.get("getUser0003", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0004 extends HttpApiEndpoint.get("getUser0004", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0005 extends HttpApiEndpoint.get("getUser0005", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0006 extends HttpApiEndpoint.get("getUser0006", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0007 extends HttpApiEndpoint.get("getUser0007", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0008 extends HttpApiEndpoint.get("getUser0008", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0009 extends HttpApiEndpoint.get("getUser0009", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0010 extends HttpApiEndpoint.get("getUser0010", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0011 extends HttpApiEndpoint.get("getUser0011", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0012 extends HttpApiEndpoint.get("getUser0012", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0013 extends HttpApiEndpoint.get("getUser0013", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0014 extends HttpApiEndpoint.get("getUser0014", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0015 extends HttpApiEndpoint.get("getUser0015", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0016 extends HttpApiEndpoint.get("getUser0016", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0017 extends HttpApiEndpoint.get("getUser0017", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0018 extends HttpApiEndpoint.get("getUser0018", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0019 extends HttpApiEndpoint.get("getUser0019", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0020 extends HttpApiEndpoint.get("getUser0020", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0021 extends HttpApiEndpoint.get("getUser0021", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0022 extends HttpApiEndpoint.get("getUser0022", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0023 extends HttpApiEndpoint.get("getUser0023", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0024 extends HttpApiEndpoint.get("getUser0024", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0025 extends HttpApiEndpoint.get("getUser0025", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0026 extends HttpApiEndpoint.get("getUser0026", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0027 extends HttpApiEndpoint.get("getUser0027", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0028 extends HttpApiEndpoint.get("getUser0028", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0029 extends HttpApiEndpoint.get("getUser0029", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0030 extends HttpApiEndpoint.get("getUser0030", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0031 extends HttpApiEndpoint.get("getUser0031", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0032 extends HttpApiEndpoint.get("getUser0032", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0033 extends HttpApiEndpoint.get("getUser0033", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0034 extends HttpApiEndpoint.get("getUser0034", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0035 extends HttpApiEndpoint.get("getUser0035", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0036 extends HttpApiEndpoint.get("getUser0036", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0037 extends HttpApiEndpoint.get("getUser0037", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0038 extends HttpApiEndpoint.get("getUser0038", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0039 extends HttpApiEndpoint.get("getUser0039", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0040 extends HttpApiEndpoint.get("getUser0040", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0041 extends HttpApiEndpoint.get("getUser0041", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0042 extends HttpApiEndpoint.get("getUser0042", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0043 extends HttpApiEndpoint.get("getUser0043", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0044 extends HttpApiEndpoint.get("getUser0044", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0045 extends HttpApiEndpoint.get("getUser0045", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0046 extends HttpApiEndpoint.get("getUser0046", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0047 extends HttpApiEndpoint.get("getUser0047", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0048 extends HttpApiEndpoint.get("getUser0048", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0049 extends HttpApiEndpoint.get("getUser0049", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0050 extends HttpApiEndpoint.get("getUser0050", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0051 extends HttpApiEndpoint.get("getUser0051", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0052 extends HttpApiEndpoint.get("getUser0052", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0053 extends HttpApiEndpoint.get("getUser0053", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0054 extends HttpApiEndpoint.get("getUser0054", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0055 extends HttpApiEndpoint.get("getUser0055", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0056 extends HttpApiEndpoint.get("getUser0056", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0057 extends HttpApiEndpoint.get("getUser0057", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0058 extends HttpApiEndpoint.get("getUser0058", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0059 extends HttpApiEndpoint.get("getUser0059", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0060 extends HttpApiEndpoint.get("getUser0060", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0061 extends HttpApiEndpoint.get("getUser0061", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0062 extends HttpApiEndpoint.get("getUser0062", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0063 extends HttpApiEndpoint.get("getUser0063", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0064 extends HttpApiEndpoint.get("getUser0064", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0065 extends HttpApiEndpoint.get("getUser0065", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0066 extends HttpApiEndpoint.get("getUser0066", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0067 extends HttpApiEndpoint.get("getUser0067", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0068 extends HttpApiEndpoint.get("getUser0068", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0069 extends HttpApiEndpoint.get("getUser0069", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0070 extends HttpApiEndpoint.get("getUser0070", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0071 extends HttpApiEndpoint.get("getUser0071", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0072 extends HttpApiEndpoint.get("getUser0072", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0073 extends HttpApiEndpoint.get("getUser0073", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0074 extends HttpApiEndpoint.get("getUser0074", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0075 extends HttpApiEndpoint.get("getUser0075", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0076 extends HttpApiEndpoint.get("getUser0076", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0077 extends HttpApiEndpoint.get("getUser0077", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0078 extends HttpApiEndpoint.get("getUser0078", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0079 extends HttpApiEndpoint.get("getUser0079", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0080 extends HttpApiEndpoint.get("getUser0080", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0081 extends HttpApiEndpoint.get("getUser0081", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0082 extends HttpApiEndpoint.get("getUser0082", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0083 extends HttpApiEndpoint.get("getUser0083", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0084 extends HttpApiEndpoint.get("getUser0084", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0085 extends HttpApiEndpoint.get("getUser0085", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0086 extends HttpApiEndpoint.get("getUser0086", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0087 extends HttpApiEndpoint.get("getUser0087", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0088 extends HttpApiEndpoint.get("getUser0088", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0089 extends HttpApiEndpoint.get("getUser0089", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0090 extends HttpApiEndpoint.get("getUser0090", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0091 extends HttpApiEndpoint.get("getUser0091", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0092 extends HttpApiEndpoint.get("getUser0092", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0093 extends HttpApiEndpoint.get("getUser0093", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0094 extends HttpApiEndpoint.get("getUser0094", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0095 extends HttpApiEndpoint.get("getUser0095", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0096 extends HttpApiEndpoint.get("getUser0096", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0097 extends HttpApiEndpoint.get("getUser0097", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0098 extends HttpApiEndpoint.get("getUser0098", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0099 extends HttpApiEndpoint.get("getUser0099", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0100 extends HttpApiEndpoint.get("getUser0100", "/users/:id", {
  params: Params,
  success: User
}) {}

const api = HttpApi.make("Api").add(
  HttpApiGroup.make("users").add(
    GetUser0001,
    GetUser0002,
    GetUser0003,
    GetUser0004,
    GetUser0005,
    GetUser0006,
    GetUser0007,
    GetUser0008,
    GetUser0009,
    GetUser0010,
    GetUser0011,
    GetUser0012,
    GetUser0013,
    GetUser0014,
    GetUser0015,
    GetUser0016,
    GetUser0017,
    GetUser0018,
    GetUser0019,
    GetUser0020,
    GetUser0021,
    GetUser0022,
    GetUser0023,
    GetUser0024,
    GetUser0025,
    GetUser0026,
    GetUser0027,
    GetUser0028,
    GetUser0029,
    GetUser0030,
    GetUser0031,
    GetUser0032,
    GetUser0033,
    GetUser0034,
    GetUser0035,
    GetUser0036,
    GetUser0037,
    GetUser0038,
    GetUser0039,
    GetUser0040,
    GetUser0041,
    GetUser0042,
    GetUser0043,
    GetUser0044,
    GetUser0045,
    GetUser0046,
    GetUser0047,
    GetUser0048,
    GetUser0049,
    GetUser0050,
    GetUser0051,
    GetUser0052,
    GetUser0053,
    GetUser0054,
    GetUser0055,
    GetUser0056,
    GetUser0057,
    GetUser0058,
    GetUser0059,
    GetUser0060,
    GetUser0061,
    GetUser0062,
    GetUser0063,
    GetUser0064,
    GetUser0065,
    GetUser0066,
    GetUser0067,
    GetUser0068,
    GetUser0069,
    GetUser0070,
    GetUser0071,
    GetUser0072,
    GetUser0073,
    GetUser0074,
    GetUser0075,
    GetUser0076,
    GetUser0077,
    GetUser0078,
    GetUser0079,
    GetUser0080,
    GetUser0081,
    GetUser0082,
    GetUser0083,
    GetUser0084,
    GetUser0085,
    GetUser0086,
    GetUser0087,
    GetUser0088,
    GetUser0089,
    GetUser0090,
    GetUser0091,
    GetUser0092,
    GetUser0093,
    GetUser0094,
    GetUser0095,
    GetUser0096,
    GetUser0097,
    GetUser0098,
    GetUser0099,
    GetUser0100
  )
)

type Groups = typeof api extends HttpApi.HttpApi<string, infer Groups> ? Groups : never
type Endpoints = HttpApiGroup.Endpoints<Groups>

export type Api = typeof api
export type EndpointIdentifiers = HttpApiEndpoint.Identifier<Endpoints>
export type EndpointRequests = HttpApiEndpoint.Request<Endpoints>
export type ServerServices = HttpApiEndpoint.ServerServices<Endpoints>
export type ClientServices = HttpApiEndpoint.ClientServices<Endpoints>
